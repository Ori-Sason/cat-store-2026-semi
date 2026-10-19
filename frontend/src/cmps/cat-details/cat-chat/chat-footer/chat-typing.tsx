import type React from 'react'
import type { UserRef } from '@cat-store/shared'

interface ChatTypingProps {
  typers: UserRef[] // in the order they started
}

// The line between the log and the composer: three dots and who's typing. No chips, unlike the
// msg rows. Nothing at all while nobody types, so no empty strip sits above the composer.
// Not a live region: a screen reader would announce every typer coming and going
export const ChatTyping: React.FC<ChatTypingProps> = ({ typers }) => {
  if (!typers.length) return null
  return (
    <p className="chat-typing">
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="txt">{_getTypingTxt(typers.map((typer) => typer.fullname))}</span>
    </p>
  )
}

// Two names at most, so the line stays one line in the narrow panel
function _getTypingTxt(names: string[]) {
  const [first, second] = names
  if (names.length === 1) return `${first} is typing…`
  if (names.length === 2) return `${first} and ${second} are typing…`
  const othersCount = names.length - 2
  return `${first}, ${second} and ${othersCount} ${othersCount === 1 ? 'other' : 'others'} are typing…`
}
