import { act, fireEvent, render, screen } from '@testing-library/react'
import SafeImage from './index'

jest.mock('@taroify/core/image', () => {
  const React = require('react')

  const MockTaroifyImage = ({ src, onError, onLoad }: { src?: string; onError?: () => void; onLoad?: () => void }) => {
    const [failed, setFailed] = React.useState(false)

    if (failed) {
      return <div data-testid='failed-image'>failed</div>
    }

    return (
      <img
        alt=''
        data-testid='safe-image'
        src={src}
        onLoad={onLoad}
        onError={() => {
          setFailed(true)
          onError?.()
        }}
      />
    )
  }

  return { __esModule: true, default: MockTaroifyImage }
})

describe('SafeImage', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('remounts the image component when falling back after a load error', () => {
    render(<SafeImage src='https://example.com/broken.png' fallback='fallback.png' />)

    fireEvent.error(screen.getByTestId('safe-image'))

    expect(screen.queryByTestId('failed-image')).not.toBeInTheDocument()
    expect(screen.getByTestId('safe-image')).toHaveAttribute('src', 'fallback.png')
  })

  it('falls back to the placeholder when a remote image does not load in time', async () => {
    jest.useFakeTimers()
    render(<SafeImage src='https://cdn.example.com/slow.png' data-testid='safe-image' />)

    expect(screen.getByTestId('safe-image')).toHaveAttribute('src', 'https://cdn.example.com/slow.png')

    await act(async () => {
      jest.advanceTimersByTime(2600)
      await Promise.resolve()
    })

    expect(screen.getByTestId('safe-image')).toHaveAttribute('src', 'test-file-stub')
  })
})
