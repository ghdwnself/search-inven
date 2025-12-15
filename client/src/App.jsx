import { useState } from 'react';
import Sidebar from './components/Sidebar';
import SearchView from './components/SearchView';
import BulkSearchView from './components/BulkSearchView';
import AdminView from './components/AdminView';

function App() {
  const [activeView, setActiveView] = useState('search');

  return (
    <div className="app-container">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="main-content">
        {activeView === 'search' && <SearchView />}
        {activeView === 'bulk' && <BulkSearchView />}
        {activeView === 'admin' && <AdminView />}
      </main>
    </div>
  );
}

export default App;
