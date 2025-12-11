import React from 'react';

function Sidebar({ activeView, setActiveView }) {
  return (
    <aside className="sidebar">
      <div className="logo-container">
        <img src="/nf_logo.png" alt="Logo" />
      </div>
      <nav>
        <ul className="menu-list">
          <li
            className={`menu-item ${activeView === 'search' ? 'active' : ''}`}
            onClick={() => setActiveView('search')}
          >
            📦 재고 조회
          </li>
          <li
            className={`menu-item ${activeView === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveView('bulk')}
          >
            🔍 다중 검색
          </li>
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
