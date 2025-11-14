const PremiumLoadingScreen = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(timer);
                    return 100;
                }
                return prev + Math.random() * 15;
            });
        }, 200);

        return () => clearInterval(timer);
    }, []);

    return React.createElement('div', {
        className: 'fixed inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex flex-col items-center justify-center z-50'
    },
        React.createElement(motion.div, {
            initial: { scale: 0 },
            animate: { scale: 1 },
            transition: { type: "spring", stiffness: 200, damping: 15 },
            className: 'mb-8'
        },
            React.createElement('div', {
                className: 'text-6xl mb-4 breathing-pulse'
            }, '🚀')
        ),

        React.createElement(motion.h1, {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { delay: 0.3 },
            className: 'text-4xl font-bold text-white mb-2'
        }, 'Project Pilot MAX'),

        React.createElement(motion.p, {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { delay: 0.5 },
            className: 'text-white/80 mb-8'
        }, 'Загрузка премиум опыта...'),

        React.createElement('div', {
            className: 'w-64 h-2 bg-white/20 rounded-full overflow-hidden'
        },
            React.createElement(motion.div, {
                initial: { width: 0 },
                animate: { width: `${progress}%` },
                className: 'h-full bg-white rounded-full transition-all duration-300'
            })
        ),

        React.createElement(motion.p, {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: { delay: 0.7 },
            className: 'text-white/60 mt-4 text-sm'
        }, `${Math.round(progress)}%`)
    );
};

const ConfettiEffect = () => {
    return React.createElement(motion.div, {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        className: 'confetti-container'
    },
        React.createElement('div', { className: 'flex items-center justify-center h-full' },
            React.createElement(motion.div, {
                initial: { scale: 0 },
                animate: { scale: 1 },
                transition: { type: "spring", stiffness: 200, damping: 15 },
                className: 'text-8xl'
            }, '🎉')
        )
    );
};
