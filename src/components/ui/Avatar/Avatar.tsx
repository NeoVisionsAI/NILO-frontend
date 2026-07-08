import './Avatar.css'

interface AvatarProps {
  name: string
  src?: string
  size?: number
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function Avatar({ name, src, size = 36 }: AvatarProps) {
  const style = { width: size, height: size, fontSize: size * 0.4 }
  if (src) {
    return <img className="nilo-avatar" src={src} alt={name} style={style} />
  }
  return (
    <span className="nilo-avatar nilo-avatar--fallback" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
