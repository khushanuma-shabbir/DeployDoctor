import { Outlet, NavLink } from 'react-router-dom';
import './Layout.css';

function Layout() {
  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🩺</span>
            <h1>DeployDoctor</h1>
          </div>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Dashboard
            </NavLink>
            <NavLink to="/scan" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              New Scan
            </NavLink>
            <NavLink to="/qa-agent" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              QA Agent
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              History
            </NavLink>
            <NavLink to="/help" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Help
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>
      <footer className="footer">
        <div className="container">
          <p>DeployDoctor v1.0.0 - React Debugging Assistant</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
