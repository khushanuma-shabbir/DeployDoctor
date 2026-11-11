import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './App.css';

function HomePage() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  return (
    <div className="page">
      <h1>Healthy React Application</h1>
      <p>This application has no intentional errors</p>
      
      <div className="card">
        <h2>Interactive Counter</h2>
        <button id="increment-btn" onClick={() => setCount(count + 1)}>
          Count is: {count}
        </button>
        <button onClick={() => setCount(0)}>Reset</button>
      </div>

      <div className="card">
        <h2>Navigation</h2>
        <button onClick={() => navigate('/about')}>Go to About</button>
        <button onClick={() => navigate('/contact')}>Go to Contact</button>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="page">
      <h1>About Us</h1>
      <p>This is a fully functional about page with working navigation.</p>
      <nav>
        <Link to="/">Home</Link> | <Link to="/contact">Contact</Link>
      </nav>
      <img src="/logo.svg" alt="Logo" width="50" />
    </div>
  );
}

function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="page">
      <h1>Contact Us</h1>
      {submitted && <div className="success">Form submitted successfully!</div>}
      
      <form id="contact-form" onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>
        <div>
          <label>Message:</label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({...formData, message: e.target.value})}
            required
          />
        </div>
        <button type="submit">Send Message</button>
      </form>

      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link>
      </nav>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
