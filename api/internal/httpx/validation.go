package httpx

// ValidationBuilder collects field-level validation errors.
type ValidationBuilder struct {
	errors []FieldError
}

// NewValidationBuilder creates a new builder.
func NewValidationBuilder() *ValidationBuilder {
	return &ValidationBuilder{}
}

// AddError appends a validation error for a field.
func (vb *ValidationBuilder) AddError(field, message string) *ValidationBuilder {
	vb.errors = append(vb.errors, FieldError{Field: field, Message: message})
	return vb
}

// AddErrorIf appends an error only if condition is true.
func (vb *ValidationBuilder) AddErrorIf(condition bool, field, message string) *ValidationBuilder {
	if condition {
		vb.AddError(field, message)
	}
	return vb
}

// AddIfEmpty appends an error if the trimmed string is empty.
func (vb *ValidationBuilder) AddIfEmpty(field, trimmed string) *ValidationBuilder {
	if trimmed == "" {
		vb.AddError(field, field+" is required")
	}
	return vb
}

// AddIfInvalid appends an error if value is not in the allowed list.
func (vb *ValidationBuilder) AddIfInvalid(field, value string, allowed ...string) *ValidationBuilder {
	if value == "" {
		return vb
	}
	for _, a := range allowed {
		if a == value {
			return vb
		}
	}
	vb.AddError(field, "invalid "+field)
	return vb
}

// Errors returns the collected errors, or nil if none.
func (vb *ValidationBuilder) Errors() []FieldError {
	if len(vb.errors) == 0 {
		return nil
	}
	return vb.errors
}

// HasErrors returns true if any errors were collected.
func (vb *ValidationBuilder) HasErrors() bool {
	return len(vb.errors) > 0
}
