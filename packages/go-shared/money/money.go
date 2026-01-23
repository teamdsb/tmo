package money

// Fen represents the minor currency unit (1/100 of a yuan).
type Fen int64

const Zero Fen = 0

func FromInt64(value int64) Fen {
	return Fen(value)
}

func (f Fen) Int64() int64 {
	return int64(f)
}
