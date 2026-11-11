import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

function BrokenComponent() {
  // This will cause a rendering error
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Intentional undefined access
    console.log(data.nonexistent.property);
  }, []);
  
  return <div>This should crash</div>;
}

function HomePage() {
  const [count, setCount] = useState(0);

  const handleBrokenClick = () => {
    // Intentional error
    throw new Error('Button click error!');
  };

  // Failed API request
  useEffect(() => {
    fetch('/api/nonexistent-endpoint')
      .catch(err => console.error('API error:', err));
  }, []);

  return (
    <div style={{padding: '20px'}}>
      <h1>Broken React Application</h1>
      <p>This app has intentional errors</p>
      
      <button onClick={() => setCount(count + 1)}>
        Working button: {count}
      </button>
      
      <button onClick={handleBrokenClick}>
        Click me to crash!
      </button>

      {/* Missing image */}
      <img src="/missing-image.png" alt="Broken" />
      
      <nav>
        <Link to="/broken">Go to Broken Page</Link> | 
        <Link to="/nonexistent">404 Route</Link>
      </nav>
    </div>
  );
}

function BrokenPage() {
  return (
    <div style={{padding: '20px'}}>
      <h1>Broken Page</h1>
      <BrokenComponent />
      <Link to="/">Home</Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/broken" element={<BrokenPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
