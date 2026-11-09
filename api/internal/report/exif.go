package report

import (
	"bytes"
	"encoding/binary"
	"math"
	"net/http"
	"strings"
	"time"
)

// MaxPhotoBytes is the 5 MB per-photo upload limit (§6.15, §11.2).
const MaxPhotoBytes = 5 * 1024 * 1024

// MaxReportPhotos is the maximum number of photos per report (§6.15, §11.2).
const MaxReportPhotos = 4

// geotagRadiusMeters is the maximum distance from a report's coordinates for
// an EXIF GPS fix to be marked valid.
const geotagRadiusMeters = 1000.0

// DetectImageMIME inspects the magic bytes of data and returns the canonical
// MIME type and file extension when it is JPEG, PNG, or WebP (§11.2, §13.3).
func DetectImageMIME(data []byte) (mimeType string, ext string, ok bool) {
	if len(data) == 0 {
		return "", "", false
	}
	detected := http.DetectContentType(data)
	switch detected {
	case "image/jpeg":
		return "image/jpeg", ".jpg", true
	case "image/png":
		return "image/png", ".png", true
	case "image/webp":
		return "image/webp", ".webp", true
	default:
		return "", "", false
	}
}

// ExifMetadata holds the optional geotag and capture timestamp extracted from
// an uploaded image (§6.15, §11.4).
type ExifMetadata struct {
	Latitude  *float64
	Longitude *float64
	TakenAt   *time.Time
}

// EvaluateGeotag determines is_geotag_valid for a photo (§3.8, §11.4).
// When no GPS coordinates exist in EXIF, it returns nil.
func EvaluateGeotag(meta ExifMetadata, refLat, refLng *float64) *bool {
	if meta.Latitude == nil || meta.Longitude == nil {
		return nil
	}
	lat, lng := *meta.Latitude, *meta.Longitude
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 || math.IsNaN(lat) || math.IsNaN(lng) {
		valid := false
		return &valid
	}
	valid := true
	if refLat != nil && refLng != nil {
		valid = HaversineMeters(lat, lng, *refLat, *refLng) <= geotagRadiusMeters
	}
	return &valid
}

// ExtractEXIF parses EXIF GPS coordinates and capture timestamps from JPEG or
// WebP image bytes. Missing or malformed EXIF segments yield nil fields without
// failing the upload (§11.4).
func ExtractEXIF(data []byte) ExifMetadata {
	tiff := findTIFFPayload(data)
	if len(tiff) < 8 {
		return ExifMetadata{}
	}
	return parseTIFF(tiff)
}

func findTIFFPayload(data []byte) []byte {
	// JPEG: starts with 0xFF 0xD8, scan markers for APP1 (0xFF 0xE1) with "Exif\x00\x00".
	if len(data) >= 4 && data[0] == 0xFF && data[1] == 0xD8 {
		pos := 2
		for pos+4 <= len(data) {
			if data[pos] != 0xFF {
				break
			}
			marker := data[pos+1]
			if marker == 0xFF {
				pos++
				continue
			}
			if marker == 0xD9 || marker == 0xDA {
				break
			}
			segLen := int(binary.BigEndian.Uint16(data[pos+2 : pos+4]))
			if segLen < 2 || pos+2+segLen > len(data) {
				break
			}
			seg := data[pos+4 : pos+2+segLen]
			if marker == 0xE1 && len(seg) > 6 && bytes.Equal(seg[:6], []byte("Exif\x00\x00")) {
				return seg[6:]
			}
			pos += 2 + segLen
		}
	}

	// WebP: RIFF....WEBP container with an "EXIF" chunk.
	if len(data) >= 12 && bytes.Equal(data[:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")) {
		pos := 12
		for pos+8 <= len(data) {
			chunkID := data[pos : pos+4]
			chunkLen := int(binary.LittleEndian.Uint32(data[pos+4 : pos+8]))
			if chunkLen < 0 || pos+8+chunkLen > len(data) {
				break
			}
			payload := data[pos+8 : pos+8+chunkLen]
			if bytes.Equal(chunkID, []byte("EXIF")) {
				if len(payload) > 6 && bytes.Equal(payload[:6], []byte("Exif\x00\x00")) {
					return payload[6:]
				}
				return payload
			}
			pad := chunkLen % 2
			pos += 8 + chunkLen + pad
		}
	}

	return nil
}

func parseTIFF(tiff []byte) ExifMetadata {
	var bo binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return ExifMetadata{}
	}
	if bo.Uint16(tiff[2:4]) != 0x002A {
		return ExifMetadata{}
	}
	ifd0Offset := int(bo.Uint32(tiff[4:8]))
	if ifd0Offset < 8 || ifd0Offset+2 > len(tiff) {
		return ExifMetadata{}
	}

	var (
		meta      ExifMetadata
		exifIFD   int
		gpsIFD    int
		ifd0Time  *time.Time
	)

	entries := int(bo.Uint16(tiff[ifd0Offset : ifd0Offset+2]))
	base := ifd0Offset + 2
	for i := 0; i < entries && base+12 <= len(tiff); i, base = i+1, base+12 {
		tag := bo.Uint16(tiff[base : base+2])
		typ := bo.Uint16(tiff[base+2 : base+4])
		count := int(bo.Uint32(tiff[base+4 : base+8]))
		valBytes := tiff[base+8 : base+12]

		switch tag {
		case 0x0132: // DateTime
			if s, ok := readExifASCII(tiff, bo, typ, count, valBytes); ok {
				if t, ok := parseExifTime(s); ok {
					ifd0Time = &t
				}
			}
		case 0x8769: // ExifIFDPointer
			if typ == 4 && count == 1 {
				exifIFD = int(bo.Uint32(valBytes))
			}
		case 0x8825: // GPSInfoIFDPointer
			if typ == 4 && count == 1 {
				gpsIFD = int(bo.Uint32(valBytes))
			}
		}
	}

	if exifIFD >= 8 && exifIFD+2 <= len(tiff) {
		subEntries := int(bo.Uint16(tiff[exifIFD : exifIFD+2]))
		subBase := exifIFD + 2
		for i := 0; i < subEntries && subBase+12 <= len(tiff); i, subBase = i+1, subBase+12 {
			tag := bo.Uint16(tiff[subBase : subBase+2])
			typ := bo.Uint16(tiff[subBase+2 : subBase+4])
			count := int(bo.Uint32(tiff[subBase+4 : subBase+8]))
			valBytes := tiff[subBase+8 : subBase+12]
			if tag == 0x9003 { // DateTimeOriginal
				if s, ok := readExifASCII(tiff, bo, typ, count, valBytes); ok {
					if t, ok := parseExifTime(s); ok {
						meta.TakenAt = &t
					}
				}
			}
		}
	}
	if meta.TakenAt == nil {
		meta.TakenAt = ifd0Time
	}

	if gpsIFD >= 8 && gpsIFD+2 <= len(tiff) {
		var (
			latRef, lonRef string
			latDMS, lonDMS [3]float64
			hasLat, hasLon bool
		)
		subEntries := int(bo.Uint16(tiff[gpsIFD : gpsIFD+2]))
		subBase := gpsIFD + 2
		for i := 0; i < subEntries && subBase+12 <= len(tiff); i, subBase = i+1, subBase+12 {
			tag := bo.Uint16(tiff[subBase : subBase+2])
			typ := bo.Uint16(tiff[subBase+2 : subBase+4])
			count := int(bo.Uint32(tiff[subBase+4 : subBase+8]))
			valBytes := tiff[subBase+8 : subBase+12]

			switch tag {
			case 0x0001: // GPSLatitudeRef
				if s, ok := readExifASCII(tiff, bo, typ, count, valBytes); ok {
					latRef = strings.ToUpper(strings.TrimSpace(s))
				}
			case 0x0002: // GPSLatitude
				if dms, ok := readExifDMS(tiff, bo, typ, count, valBytes); ok {
					latDMS = dms
					hasLat = true
				}
			case 0x0003: // GPSLongitudeRef
				if s, ok := readExifASCII(tiff, bo, typ, count, valBytes); ok {
					lonRef = strings.ToUpper(strings.TrimSpace(s))
				}
			case 0x0004: // GPSLongitude
				if dms, ok := readExifDMS(tiff, bo, typ, count, valBytes); ok {
					lonDMS = dms
					hasLon = true
				}
			}
		}
		if hasLat && hasLon {
			lat := dmsToDecimal(latDMS, latRef == "S")
			lon := dmsToDecimal(lonDMS, lonRef == "W")
			meta.Latitude = &lat
			meta.Longitude = &lon
		}
	}

	return meta
}

func readExifASCII(tiff []byte, bo binary.ByteOrder, typ uint16, count int, valBytes []byte) (string, bool) {
	if typ != 2 || count <= 0 {
		return "", false
	}
	var raw []byte
	if count <= 4 {
		raw = valBytes[:count]
	} else {
		off := int(bo.Uint32(valBytes))
		if off < 0 || off+count > len(tiff) {
			return "", false
		}
		raw = tiff[off : off+count]
	}
	return strings.TrimRight(string(raw), "\x00 "), true
}

func readExifDMS(tiff []byte, bo binary.ByteOrder, typ uint16, count int, valBytes []byte) ([3]float64, bool) {
	var out [3]float64
	if typ != 5 || count != 3 {
		return out, false
	}
	off := int(bo.Uint32(valBytes))
	if off < 0 || off+24 > len(tiff) {
		return out, false
	}
	for i := 0; i < 3; i++ {
		num := bo.Uint32(tiff[off+i*8 : off+i*8+4])
		den := bo.Uint32(tiff[off+i*8+4 : off+i*8+8])
		if den == 0 {
			return out, false
		}
		out[i] = float64(num) / float64(den)
	}
	return out, true
}

func dmsToDecimal(dms [3]float64, negative bool) float64 {
	dec := dms[0] + dms[1]/60.0 + dms[2]/3600.0
	dec = math.Round(dec*1e6) / 1e6
	if negative {
		dec = -dec
	}
	return dec
}

func parseExifTime(raw string) (time.Time, bool) {
	t, err := time.Parse("2006:01:02 15:04:05", strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, false
	}
	return t.UTC(), true
}
