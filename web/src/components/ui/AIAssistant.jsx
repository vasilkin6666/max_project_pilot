const AIAssistant = ({ suggestions }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return React.createElement(motion.div, {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        className: 'glass-morphism rounded-2xl p-6 mb-6 mx-4'
    },
        React.createElement('div', {
            className: 'flex items-center justify-between mb-4'
        },
            React.createElement('div', {
                className: 'flex items-center space-x-3'
            },
                React.createElement('div', {
                    className: 'w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold'
                }, 'AI'),
                React.createElement('div', {},
                    React.createElement('h3', {
                        className: 'font-bold text-gray-800 dark:text-white'
                    }, 'AI Ассистент'),
                    React.createElement('p', {
                        className: 'text-sm text-gray-600 dark:text-gray-300'
                    }, 'Умные рекомендации для ваших проектов')
                )
            ),

            React.createElement(motion.button, {
                whileHover: { scale: 1.1 },
                whileTap: { scale: 0.9 },
                onClick: () => setIsExpanded(!isExpanded),
                className: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }, isExpanded ? '▼' : '▶')
        ),

        isExpanded && React.createElement(AnimatePresence, {},
            React.createElement(motion.div, {
                initial: { opacity: 0, height: 0 },
                animate: { opacity: 1, height: 'auto' },
                exit: { opacity: 0, height: 0 },
                className: 'space-y-3'
            },
                suggestions.map((suggestion, index) =>
                    React.createElement(motion.div, {
                        key: index,
                        initial: { opacity: 0, x: -20 },
                        animate: { opacity: 1, x: 0 },
                        transition: { delay: index * 0.1 },
                        className: 'flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl'
                    },
                        React.createElement('div', { className: 'flex-1' },
                            React.createElement('p', {
                                className: 'font-medium text-gray-800 dark:text-white'
                            }, suggestion.title),
                            React.createElement('p', {
                                className: 'text-sm text-gray-600 dark:text-gray-300'
                            }, suggestion.description)
                        ),

                        React.createElement(motion.button, {
                            whileHover: { scale: 1.05 },
                            whileTap: { scale: 0.95 },
                            className: 'px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors'
                        }, 'Применить')
                    )
                )
            )
        )
    );
};
