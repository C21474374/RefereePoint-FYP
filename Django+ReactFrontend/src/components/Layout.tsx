import { Outlet } from 'react-router-dom'
import TopNavBar from './TopNavBar';
import AppFooter from './AppFooter';

export default function Layout() {
  return (
    <div className="app-shell">
      <TopNavBar />
      <main className="app-main">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  )
}
