import { ui } from '../../../shared/styles/classes';
import { Link, useParams } from 'react-router-dom';
import { articles } from '../data/articles';

export function BlogPage() {
  const { articleId } = useParams();
  const article =
    articleId && Object.hasOwn(articles, articleId)
      ? articles[articleId as keyof typeof articles]
      : null;
  return (
    <main id="main" className={ui('container content-page reading-page')}>
      <div className={ui('breadcrumb')}>
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/blog">Blog</Link>
      </div>
      <span className={ui('eyebrow')}>GÓC CẢM HỨNG · NỘI DUNG MINH HỌA</span>
      {article ? (
        <>
          <h1>{article.title}</h1>
          {article.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <Link className={ui('button button-outline')} to="/blog">
            Các bài viết khác
          </Link>
        </>
      ) : articleId ? (
        <>
          <h1>Không tìm thấy bài viết</h1>
          <Link className={ui('button')} to="/blog">
            Về Blog
          </Link>
        </>
      ) : (
        <>
          <h1>Trước khi mình lên đường</h1>
          <p>Một chút chuẩn bị để cuộc hẹn trọn vẹn hơn.</p>
          <div className={ui('article-list')}>
            {Object.entries(articles).map(([id, item], index) => (
              <Link className={ui('journal-card')} to={`/blog/${id}`} key={id}>
                <span className={ui('journal-number')}>0{index + 1}</span>
                <h2>{item.title}</h2>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
