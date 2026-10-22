export default function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-warn bg-warn/10 rounded-tag px-3 py-2 mt-2">{message}</p>;
}
