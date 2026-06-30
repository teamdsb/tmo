package mediaopt

import (
	"bytes"
	"encoding/binary"
	"errors"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"math"
	"os"
	"path/filepath"
)

const (
	DefaultMaxDimension = 1600
	DefaultJPEGQuality  = 82
)

type Result struct {
	Data        []byte
	ContentType string
	Extension   string
	Width       int
	Height      int
}

func Optimize(data []byte, contentType string, maxDimension int) (Result, error) {
	if maxDimension <= 0 {
		maxDimension = DefaultMaxDimension
	}
	var decoded image.Image
	var err error
	switch contentType {
	case "image/jpeg":
		decoded, err = jpeg.Decode(bytes.NewReader(data))
	case "image/png":
		decoded, err = png.Decode(bytes.NewReader(data))
	default:
		return Result{}, errors.New("unsupported optimizable image type")
	}
	if err != nil {
		return Result{}, errors.New("invalid image data")
	}
	if contentType == "image/jpeg" {
		decoded = orient(decoded, jpegOrientation(data))
	}
	decoded = resizeToFit(decoded, maxDimension)

	var output bytes.Buffer
	extension := ".jpg"
	if contentType == "image/png" {
		extension = ".png"
		encoder := png.Encoder{CompressionLevel: png.DefaultCompression}
		err = encoder.Encode(&output, decoded)
	} else {
		err = jpeg.Encode(&output, decoded, &jpeg.Options{Quality: DefaultJPEGQuality})
	}
	if err != nil {
		return Result{}, errors.New("failed to encode optimized image")
	}
	bounds := decoded.Bounds()
	return Result{
		Data:        output.Bytes(),
		ContentType: contentType,
		Extension:   extension,
		Width:       bounds.Dx(),
		Height:      bounds.Dy(),
	}, nil
}

func WriteAtomically(targetPath string, data []byte) error {
	dir := filepath.Dir(targetPath)
	tmp, err := os.CreateTemp(dir, ".media-opt-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmpPath)
	}
	if _, err := tmp.Write(data); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Chmod(0o644); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	return nil
}

func resizeToFit(source image.Image, maxDimension int) image.Image {
	bounds := source.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width <= maxDimension && height <= maxDimension {
		return source
	}
	scale := math.Min(float64(maxDimension)/float64(width), float64(maxDimension)/float64(height))
	targetWidth := int(math.Round(float64(width) * scale))
	targetHeight := int(math.Round(float64(height) * scale))
	target := image.NewNRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	for y := 0; y < targetHeight; y++ {
		sy := bounds.Min.Y + y*height/targetHeight
		for x := 0; x < targetWidth; x++ {
			sx := bounds.Min.X + x*width/targetWidth
			target.Set(x, y, source.At(sx, sy))
		}
	}
	return target
}

func orient(source image.Image, orientation int) image.Image {
	if orientation < 2 || orientation > 8 {
		return source
	}
	b := source.Bounds()
	w, h := b.Dx(), b.Dy()
	outW, outH := w, h
	if orientation >= 5 {
		outW, outH = h, w
	}
	target := image.NewNRGBA(image.Rect(0, 0, outW, outH))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var dx, dy int
			switch orientation {
			case 2:
				dx, dy = w-1-x, y
			case 3:
				dx, dy = w-1-x, h-1-y
			case 4:
				dx, dy = x, h-1-y
			case 5:
				dx, dy = y, x
			case 6:
				dx, dy = h-1-y, x
			case 7:
				dx, dy = h-1-y, w-1-x
			case 8:
				dx, dy = y, w-1-x
			}
			target.Set(dx, dy, source.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return target
}

func jpegOrientation(data []byte) int {
	if len(data) < 4 || data[0] != 0xff || data[1] != 0xd8 {
		return 1
	}
	for offset := 2; offset+4 <= len(data); {
		if data[offset] != 0xff {
			break
		}
		marker := data[offset+1]
		offset += 2
		if marker == 0xda || marker == 0xd9 {
			break
		}
		if offset+2 > len(data) {
			break
		}
		length := int(binary.BigEndian.Uint16(data[offset : offset+2]))
		if length < 2 || offset+length > len(data) {
			break
		}
		segment := data[offset+2 : offset+length]
		if marker == 0xe1 && len(segment) >= 14 && bytes.Equal(segment[:6], []byte("Exif\x00\x00")) {
			if value := tiffOrientation(segment[6:]); value != 0 {
				return value
			}
		}
		offset += length
	}
	return 1
}

func tiffOrientation(data []byte) int {
	if len(data) < 8 {
		return 0
	}
	var order binary.ByteOrder
	switch string(data[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 0
	}
	ifdOffset := int(order.Uint32(data[4:8]))
	if ifdOffset < 0 || ifdOffset+2 > len(data) {
		return 0
	}
	count := int(order.Uint16(data[ifdOffset : ifdOffset+2]))
	entries := data[ifdOffset+2:]
	for index := 0; index < count && index*12+12 <= len(entries); index++ {
		entry := entries[index*12 : index*12+12]
		if order.Uint16(entry[:2]) == 0x0112 && order.Uint16(entry[2:4]) == 3 && order.Uint32(entry[4:8]) >= 1 {
			return int(order.Uint16(entry[8:10]))
		}
	}
	return 0
}

func ReadAllLimited(reader io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, errors.New("file exceeds limit")
	}
	return data, nil
}
