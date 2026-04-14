export default function AppFooter() {
  const currentYear = new Date().getFullYear();

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div>
          <h3>RefereePoint</h3>
          <p>Referee scheduling, cover requests, events, and earnings in one place.</p>
        </div>
        <div className="app-footer-actions">
          <p className="app-footer-meta">(c) {currentYear} RefereePoint</p>
          <button className="app-footer-back-to-top" type="button" onClick={handleBackToTop}>
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
