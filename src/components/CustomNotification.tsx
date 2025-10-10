import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationProps {
  isVisible: boolean;
  message: string;
  type?: 'loading' | 'success' | 'error';
  progress?: number;
}

const CustomNotification: React.FC<NotificationProps> = ({
  isVisible,
  message,
  type = 'loading',
  progress = 0
}) => {
  console.log('🎬 NOTIFICATION DEBUG: CustomNotification render', { isVisible, message, type, progress });
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <motion.div
            initial={{ scale: 0, rotate: -720 }}
            animate={{
              scale: [0, 1.5, 1],
              rotate: [0, 360, 0],
              filter: ['hue-rotate(0deg)', 'hue-rotate(180deg)', 'hue-rotate(0deg)']
            }}
            transition={{
              type: "tween",
              ease: "easeOut",
              duration: 1.2
            }}
            className="w-8 h-8 text-green-400 text-2xl"
          >
            ✓
          </motion.div>
        );
      case 'error':
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{
              scale: [0, 1.3, 0.9, 1.1, 1],
              rotate: [0, -10, 10, -5, 0],
              x: [0, -3, 3, -1, 0]
            }}
            transition={{
              type: "tween",
              ease: "easeOut",
              duration: 0.8
            }}
            className="w-8 h-8 text-red-400 text-2xl"
          >
            ✕
          </motion.div>
        );
      default:
        return (
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.2, 1],
              borderColor: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)']
            }}
            transition={{
              rotate: { duration: 1, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              borderColor: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            }}
            className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full"
          />
        );
    }
  };

  const getThemeColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'from-green-900/80 via-green-800/60 to-green-700/40',
          glow: 'rgba(34, 197, 94, 0.4)',
          accent: '#22c55e'
        };
      case 'error':
        return {
          bg: 'from-red-900/80 via-red-800/60 to-red-700/40',
          glow: 'rgba(239, 68, 68, 0.4)',
          accent: '#ef4444'
        };
      default:
        return {
          bg: 'from-gray-900/80 via-gray-800/60 to-gray-700/40',
          glow: 'rgba(255, 255, 255, 0.2)',
          accent: '#ffffff'
        };
    }
  };

  const theme = getThemeColors();

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Fullscreen overlay for dramatic effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9998] pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center, ${theme.glow} 0%, transparent 70%)`
            }}
          />

          {/* Main notification */}
          <motion.div
            initial={{
              opacity: 0,
              y: -200,
              scale: 0.3,
              rotateX: -90,
              filter: 'blur(20px) brightness(0.3)'
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              rotateX: 0,
              filter: 'blur(0px) brightness(1)'
            }}
            exit={{
              opacity: 0,
              y: -200,
              scale: 0.3,
              rotateX: 90,
              filter: 'blur(20px) brightness(0.3)'
            }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
              mass: 1
            }}
            className="fixed top-16 left-1/2 transform -translate-x-1/2 z-[9999]"
          >
            {/* Outer glow container */}
            <motion.div
              animate={{
                boxShadow: [
                  `0 0 20px ${theme.glow}`,
                  `0 0 40px ${theme.glow}`,
                  `0 0 20px ${theme.glow}`
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative"
            >
              {/* Main notification container */}
              <motion.div
                className={`
                  relative overflow-hidden rounded-2xl border-2 border-white/30
                  backdrop-blur-xl shadow-2xl min-w-[400px] max-w-2xl
                  bg-gradient-to-br ${theme.bg}
                `}
                animate={{
                  borderColor: [
                    'rgba(255,255,255,0.3)',
                    theme.accent + '80',
                    'rgba(255,255,255,0.3)'
                  ]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {/* Animated background patterns */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    background: [
                      `radial-gradient(ellipse at 20% 30%, ${theme.accent}20 0%, transparent 60%)`,
                      `radial-gradient(ellipse at 80% 70%, ${theme.accent}15 0%, transparent 60%)`,
                      `radial-gradient(ellipse at 40% 50%, ${theme.accent}25 0%, transparent 60%)`
                    ]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />

                {/* TV static noise overlay */}
                <motion.div
                  className="absolute inset-0 opacity-40"
                  animate={{
                    backgroundPosition: [
                      '0px 0px',
                      '100px 100px',
                      '-50px 50px',
                      '75px -25px',
                      '0px 0px'
                    ]
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  style={{
                    backgroundImage: `
                      radial-gradient(1px 1px at 10px 20px, rgba(255,255,255,0.3), transparent),
                      radial-gradient(1px 1px at 30px 60px, rgba(255,255,255,0.2), transparent),
                      radial-gradient(1px 1px at 70px 30px, rgba(255,255,255,0.25), transparent),
                      radial-gradient(1px 1px at 90px 80px, rgba(255,255,255,0.15), transparent)
                    `,
                    backgroundSize: '100px 100px, 150px 150px, 120px 120px, 80px 80px'
                  }}
                />

                {/* Content */}
                <div className="relative p-6 flex items-center gap-4">
                  {/* Icon container with extra animation */}
                  <motion.div
                    animate={{
                      y: [0, -5, 0],
                      filter: [
                        'drop-shadow(0 0 10px ' + theme.accent + ')',
                        'drop-shadow(0 0 20px ' + theme.accent + ')',
                        'drop-shadow(0 0 10px ' + theme.accent + ')'
                      ]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {getIcon()}
                  </motion.div>

                  <div className="flex-1">
                    {/* Message with typewriter effect */}
                    <motion.h3
                      className="text-white font-bold text-xl mb-1"
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                    >
                      {type === 'loading' ? 'Processing...' : type === 'success' ? 'Success!' : 'Error!'}
                    </motion.h3>

                    <motion.p
                      className="text-white/90 font-medium text-lg"
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                    >
                      {message}
                    </motion.p>

                    {/* Enhanced progress bar for loading states */}
                    {type === 'loading' && (
                      <motion.div
                        className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden"
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${theme.accent}80, ${theme.accent}, ${theme.accent}80)`
                          }}
                          initial={{ width: '0%' }}
                          animate={{ width: `${Math.max(progress, 10)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />

                        {/* Animated shine effect on progress bar */}
                        <motion.div
                          className="absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                          animate={{
                            x: ['-100%', '400%']
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Scanline effect */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `repeating-linear-gradient(
                      0deg,
                      rgba(255, 255, 255, 0.05),
                      rgba(255, 255, 255, 0.05) 1px,
                      transparent 1px,
                      transparent 3px
                    )`
                  }}
                />

                {/* Extreme glitch effect for success/error */}
                {(type === 'success' || type === 'error') && (
                  <>
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: [0, 0.6, 0, 0.4, 0, 0.8, 0],
                        x: [0, -5, 5, -2, 2, 0],
                        filter: [
                          'hue-rotate(0deg)',
                          'hue-rotate(90deg)',
                          'hue-rotate(180deg)',
                          'hue-rotate(270deg)',
                          'hue-rotate(360deg)'
                        ]
                      }}
                      transition={{
                        type: "tween",
                        ease: "linear",
                        duration: 1,
                        times: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1],
                        delay: 0.5
                      }}
                      style={{
                        background: type === 'success'
                          ? 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.3), transparent)'
                          : 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.3), transparent)'
                      }}
                    />

                    {/* Screen shake effect */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      animate={{
                        x: [0, -2, 2, -1, 1, 0],
                        y: [0, 1, -1, 0]
                      }}
                      transition={{
                        type: "tween",
                        duration: 0.5,
                        delay: 0.3,
                        ease: "easeInOut"
                      }}
                    />
                  </>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CustomNotification;