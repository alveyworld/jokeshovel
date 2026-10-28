import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="page">
      <h1 className="page__title">Nothing buried here</h1>
      <p>That page doesn’t exist.</p>
      <Link to="/" className="btn">
        Back to the Dig Site
      </Link>
    </div>
  );
}
