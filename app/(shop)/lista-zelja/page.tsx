import type { Metadata } from "next";
import { SimplePage } from "../_components/simple-page";
import { WishlistGrid } from "../_components/wishlist";

export const metadata: Metadata = { title: "Lista želja", robots: { index: false, follow: false } };

export default function WishlistPage() {
  return (
    <SimplePage title="Lista želja">
      <WishlistGrid />
    </SimplePage>
  );
}
