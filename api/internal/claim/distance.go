package claim

import (
	"math"
)

const earthRadiusMeters = 6371000.0 // Mean Earth radius in meters

// HaversineDistanceM computes the great-circle distance in meters between two coordinates.
func HaversineDistanceM(lat1, lon1, lat2, lon2 float64) float64 {
	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)

	rLat1 := lat1 * (math.Pi / 180.0)
	rLat2 := lat2 * (math.Pi / 180.0)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rLat1)*math.Cos(rLat2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	distance := earthRadiusMeters * c
	// Round to 1 decimal place (e.g. 38.4)
	return math.Round(distance*10) / 10
}
