import React from 'react';
import ReactDOM from 'react-dom/client';

// Простой главный компонент
const App = () => {
    return React.createElement('div', {
        className: 'min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center'
    },
        React.createElement('div', {
            className: 'text-center text-white'
        },
            React.createElement('h1', {
                className: 'text-4xl font-bold mb-4'
            }, '🚀 Project Pilot MAX'),
            React.createElement('p', {
                className: 'text-xl'
            }, 'Application is loading...')
        )
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
