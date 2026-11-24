export function AnimatedValue({ value }: { value: string | number }) {
  return (
    <span className="animated-value">
      <span className="animated-value-text" key={value}>
        {value}
      </span>
    </span>
  );
}
