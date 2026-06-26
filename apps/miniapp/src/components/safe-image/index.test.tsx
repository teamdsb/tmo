import { fireEvent, render, screen } from '@testing-library/react'
import SafeImage from './index'

jest.mock('@taroify/core/image', () => {
  const React = require('react')

  const MockTaroifyImage = ({ src, onError }: { src?: string; onError?: () => void }) => {
    const [failed, setFailed] = React.useState(false)

    if (failed) {
      return <div data-testid='failed-image'>failed</div>
    }

    return (
      <img
        alt=''
        data-testid='safe-image'
        src={src}
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
  it('remounts the image component when falling back after a load error', () => {
    render(<SafeImage src='https://example.com/broken.png' fallback='fallback.png' />)

    fireEvent.error(screen.getByTestId('safe-image'))

    expect(screen.queryByTestId('failed-image')).not.toBeInTheDocument()
    expect(screen.getByTestId('safe-image')).toHaveAttribute('src', 'fallback.png')
  })
})
