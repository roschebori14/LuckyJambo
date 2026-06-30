export default function Footer() {
  return (
    <footer className="border-t bg-white py-4">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Lucky Jambo. All rights reserved.
      </div>
    </footer>
  );
}
