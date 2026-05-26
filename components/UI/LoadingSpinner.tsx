export default function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin"
    />
  );
}
