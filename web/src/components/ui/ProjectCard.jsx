const ProjectCard = ({ project, onClick, index }) => {
    const stats = project.stats || {};

    return React.createElement(motion.div, {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: index * 0.1 },
        whileHover: {
            scale: 1.02,
            y: -5,
            transition: { type: "spring", stiffness: 300 }
        },
        onClick: onClick,
        className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl cursor-pointer transition-all duration-300 border border-gray-100 dark:border-gray-700 magnetic-hover'
    },
        React.createElement('div', {
            className: 'flex justify-between items-start mb-4'
        },
            React.createElement('h3', {
                className: 'text-xl font-bold text-gray-800 dark:text-white truncate flex-1 mr-3'
            }, project.title),

            React.createElement('div', {
                className: `px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                    project.is_private
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`
            }, project.is_private ? 'Приватный' : 'Публичный')
        ),

        React.createElement('p', {
            className: 'text-gray-600 dark:text-gray-300 mb-4 line-clamp-2'
        }, project.description || 'Без описания'),

        React.createElement('div', {
            className: 'grid grid-cols-2 gap-4 mb-4'
        },
            React.createElement('div', {
                className: 'text-center'
            },
                React.createElement('div', {
                    className: 'text-2xl font-bold text-blue-600 dark:text-blue-400'
                }, stats.members_count || 0),
                React.createElement('div', {
                    className: 'text-xs text-gray-500 dark:text-gray-400'
                }, 'Участников')
            ),

            React.createElement('div', {
                className: 'text-center'
            },
                React.createElement('div', {
                    className: 'text-2xl font-bold text-green-600 dark:text-green-400'
                }, stats.tasks_count || 0),
                React.createElement('div', {
                    className: 'text-xs text-gray-500 dark:text-gray-400'
                }, 'Задач')
            )
        ),

        React.createElement('div', {
            className: 'flex justify-between text-sm text-gray-500 dark:text-gray-400'
        },
            React.createElement('span', {}, `Создан: ${new Date(project.created_at).toLocaleDateString()}`),
            React.createElement('span', {
                className: 'font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded'
            }, project.hash?.substring(0, 8) || 'demo')
        )
    );
};
