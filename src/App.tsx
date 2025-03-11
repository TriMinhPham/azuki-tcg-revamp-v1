import { HomePage } from '@/pages';
import { LayeredCardDemo } from '@/pages/LayeredCardDemo';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/nft/:id" element={<HomePage />} />
          <Route path="/layered-card" element={<LayeredCardDemo />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;