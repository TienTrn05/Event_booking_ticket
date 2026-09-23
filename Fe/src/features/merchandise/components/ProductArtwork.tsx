import { ui } from '../../../shared/styles/classes';
import type { MerchandiseProduct } from '../data/catalog';

export function ProductArtwork({ product }: { product: MerchandiseProduct }) {
  return (
    <div className={ui(`product-art product-art-${product.visual}`)} aria-hidden="true">
      <div className={ui('product-object')}>
        <span>{product.displayName}</span>
        <span className={ui('product-motif')}>✳</span>
        <small>EVENT COLLECTION</small>
      </div>
    </div>
  );
}
