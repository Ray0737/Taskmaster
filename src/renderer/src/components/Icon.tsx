export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <i className={`codicon codicon-${name} ${className}`} aria-hidden="true" />
}
