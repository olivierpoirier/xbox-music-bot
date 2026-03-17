type Props = {
  children: string;
  active?: boolean;
  className?: string;
};

export default function GlitchText({
  children,
  active = true,
  className = "",
}: Props) {
  if (!active) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={`glitch-text ${className}`} data-text={children}>
      {children}
    </span>
  );
}