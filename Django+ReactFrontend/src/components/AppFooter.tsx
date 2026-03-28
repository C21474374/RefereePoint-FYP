export default function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div>
          <h3>RefereePoint</h3>
          <p>Referee scheduling, cover requests, events, and earnings in one place.</p>
        </div>
        <p className="app-footer-meta">© {currentYear} RefereePoint</p>
      </div>
    </footer>
  );
}
