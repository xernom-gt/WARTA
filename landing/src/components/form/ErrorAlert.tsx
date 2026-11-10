interface Props {
  errors: string[];
}

export default function ErrorAlert({ errors }: Props) {
  if (errors.length === 0) return null;
  return (
    <ul
      role="alert"
      className="list-inside list-disc rounded-2xl border border-bad-border bg-bad-bg p-5 text-sm text-bad-text"
    >
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
