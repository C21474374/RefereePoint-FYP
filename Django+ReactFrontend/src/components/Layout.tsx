import { Outlet } from 'react-router-dom'
import TopNavBar from './TopNavBar';

export default function Layout() {
  return (
    <div>
      <TopNavBar />
      <main style={{ marginTop: '60px' }}>
        <Outlet />
      </main>
    </div>
  )
}
