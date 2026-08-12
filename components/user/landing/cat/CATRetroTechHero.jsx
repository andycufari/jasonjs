"use client"

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./CATRetroTechHero.module.css";

// Componente del efecto Matrix
const MatrixEffect = ({ className = "" }) => {
  const canvasRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    // Set background (transparente)
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, width, height);

    // Caracteres para mostrar (mezclando numéricos, símbolos y kana japonés)
    const hackerChars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン{}[];:<>=-+*/&^%$#@!~".split("");

    // Variables de columna
    const fontSize = 12;
    const columns = Math.floor(width / fontSize);

    // Array con gotas, una por columna
    const drops = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = 1;
    }

    // Loop de animación
    const draw = () => {
      // Fondo negro semi-transparente para mostrar el rastro
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, width, height);

      // Color y fuente del texto (azul claro)
      ctx.fillStyle = "#60a5fa"; // Un tono de azul claro
      ctx.font = `${fontSize}px monospace`;

      // Loop sobre las gotas
      for (let i = 0; i < drops.length; i++) {
        // Caracter aleatorio
        const text = hackerChars[Math.floor(Math.random() * hackerChars.length)];

        // Dibuja el caracter
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Resetea aleatoriamente algunas gotas al inicio
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        // Mueve las gotas hacia abajo
        drops[i]++;
      }
    };

    // Manejo del redimensionamiento
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // Inicia el loop de animación
    const interval = setInterval(draw, 35);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-0 opacity-20 pointer-events-none ${className}`}
    />
  );
};

const HackerTitle = ({ className = "" }) => {
  return (
    <div className={`${styles.hackerEffect} ${className}`}>
      <h1 className={styles.techTitle} data-text="Club_Argentino de_Tecnología">
        <span data-text="Club_Argentino">Club_Argentino</span>
        <span data-text="de_Tecnología">de_Tecnología</span>
      </h1>
    </div>
  );
};


// Efecto de terminal Linux
const LinuxTerminal = ({ children, className = "" }) => {
  return (
    <div className={`${styles.linuxTerminal} ${className}`}>
      <div className={styles.terminalHeader}>
        <div className={styles.terminalTitle}>cat@hacklab:~</div>
        <div className={styles.windowControls}>
          <div className={`${styles.windowButton} ${styles.buttonRed}`}></div>
          <div className={`${styles.windowButton} ${styles.buttonYellow}`}></div>
          <div className={`${styles.windowButton} ${styles.buttonGreen}`}></div>
        </div>
      </div>
      <div className={styles.terminalContent}>
        {children}
      </div>
    </div>
  );
};

// Efecto de texto typewriter
const TypeWriter = ({ text, speed = 50, onComplete, className = "" }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  // Efecto de cursor parpadeante
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <div className={`font-mono ${className}`}>
      {displayText}
      <span className={`${cursorVisible ? 'opacity-100' : 'opacity-0'} transition-opacity`}>▋</span>
    </div>
  );
};

// ASCII Art animado
const AsciiAnimation = ({ frames, speed = 150, className = "" }) => {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % frames.length);
    }, speed);
    return () => clearInterval(interval);
  }, [frames.length, speed]);

  return (
    <pre className={`font-mono whitespace-pre ${className}`}>
      {frames[currentFrame]}
    </pre>
  );
};

// Componente principal del Hero
function CATRetroTechHero({ href = "/sumate"}) {
  const [bootPhase, setBootPhase] = useState(0);
  const [showMainContent, setShowMainContent] = useState(false);
  const containerRef = useRef(null);
  
  // Array de contenidos estáticos para los elementos flotantes
  const floatingContents = [
    "{}", "</>", "01", "#/", "[]", "::", "$_", "&&"
  ];
  
  // Valores fijos para los elementos flotantes para evitar problemas de hidratación
  const [floatingElements, setFloatingElements] = useState([]);
  const [isClientMounted, setIsClientMounted] = useState(false);
  
  useEffect(() => {
    // Generate floating elements only on client to avoid hydration mismatch
    setFloatingElements(Array(20).fill(0).map((_, i) => ({
      top: `${Math.floor(Math.random() * 100)}%`,
      left: `${Math.floor(Math.random() * 100)}%`,
      delay: `${Math.floor(Math.random() * 5)}s`,
      duration: `${15 + Math.floor(Math.random() * 15)}s`,
      scale: 0.5 + Math.floor(Math.random() * 50) / 100,
      opacity: (0.5 + Math.floor(Math.random() * 50) / 100).toFixed(2),
      contentIndex: i % floatingContents.length
    })));
    setIsClientMounted(true);
  }, []);

  // ASCII Art del gato (basado en el logo del CAT)
  const catAsciiFrames = [
    `/\\_/\\\n(o.o )\n(=^=)\n(---)--`,
    `/\\_/\\\n( o.o)\n(=^=)\n--(---)`,
  ];

  // Comandos estilo Linux/terminal
  const bootSequence = [
    "$ ./cat_init.sh",
    "Cargando Club Argentino de Tecnología v1.44...",
    "Verificando conexión con comunidad...",
    "Detectando talento local...",
    "Preparando entorno de innovación...",
    "Inicializando DAO...",
    "Acceso concedido. Bienvenido al futuro.",
  ];

  // Efecto para la secuencia de animación de inicio
  useEffect(() => {
    if (bootPhase < bootSequence.length) {
      const timer = setTimeout(() => {
        setBootPhase(bootPhase + 1);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      const finalTimer = setTimeout(() => {
        setShowMainContent(true);
      }, 500);
      return () => clearTimeout(finalTimer);
    }
  }, [bootPhase]);

  // Efecto para el desplazamiento suave cuando aparece el contenido principal
  // useEffect(() => {
  //   if (showMainContent && containerRef.current) {
  //     containerRef.current.scrollIntoView({ behavior: 'smooth' });
  //   }
  // }, [showMainContent]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] pt-10 pb-20 relative overflow-hidden bg-[#051022]">
      {/* Efecto Matrix en el fondo */}
      <MatrixEffect />

      {/* Overlay con efecto de scanlines para dar aspecto de monitor CRT */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#020617]/20 to-black/20 z-10"></div>
      <div className={styles.scanlines}></div>

      {/* Malla de coordenadas en el fondo (al estilo 90s) */}
      <div className={styles.gridBackground}></div>

      {/* Contenedor principal con animación fade-in */}
      <div 
        ref={containerRef}
        className={`${styles.mainContainer} ${showMainContent ? styles.fadeIn : styles.fadeOut}`}
      >
        {/* Logo ASCII y título con efecto glitch - Sin recuadro */}
        <div className="mb-10 flex flex-col items-center justify-center space-y-6">
          <AsciiAnimation frames={catAsciiFrames} speed={500} className="text-green-400 text-base md:text-xl lg:text-2xl" />
          <HackerTitle />
          <div className="flex flex-wrap justify-center gap-3 text-xs md:text-sm text-blue-300/80 font-mono">
            <span className="bg-blue-950/50 px-3 py-1 rounded-full border border-blue-500/20">&lt;innovación&gt;</span>
            <span className="bg-blue-950/50 px-3 py-1 rounded-full border border-blue-500/20">&lt;comunidad&gt;</span>
            <span className="bg-blue-950/50 px-3 py-1 rounded-full border border-blue-500/20">&lt;tecnología&gt;</span>
            <span className="bg-blue-950/50 px-3 py-1 rounded-full border border-blue-500/20">&lt;descentralización&gt;</span>
          </div>
        </div>

        {/* Subtítulo en terminal Linux */}
        <div className="max-w-3xl mx-auto mb-16">
          
            <p className="text-base md:text-lg font-mono text-white leading-relaxed">
              <span className="text-green-400">¿Te copa la tecnología?<br /></span>
              <span className="text-white">Somos una </span>
              <span className="text-blue-400">Organización Autónoma Descentralizada</span><br />
              <span className="text-white">de locos por la innovación que quiere cambiar</span><br />
              <span className="text-white">el mundo, sí, desde Argentina.</span>
            </p>
          
        </div>

        {/* Botón de call-to-action */}
        <div className="mt-8 flex justify-center">
          <Link href={href} className={styles.ctaButton}>
            <span className={styles.ctaButtonContent}>
              <span className="mr-2 font-mono">$</span> SUMATE
              <span className={styles.ctaButtonCursor}>_</span>
            </span>
            <span className={styles.ctaButtonOverlay}></span>
          </Link>
        </div>

        {/* Iconos tecnológicos flotantes alrededor - versión con índices para evitar problemas de hidratación */}
        {isClientMounted && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {floatingElements.map((element, i) => (
              <div 
                key={i}
                className={`absolute text-blue-500/20 font-mono whitespace-nowrap ${styles.floatingElement}`}
                style={{
                  top: element.top,
                  left: element.left,
                  animationDelay: element.delay,
                  animationDuration: element.duration,
                  transform: `scale(${element.scale})`,
                  opacity: element.opacity
                }}
              >
                {floatingContents[element.contentIndex]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Secuencia de inicialización (solo visible al principio) */}
      {!showMainContent && (
        <div className={`${styles.bootSequence} ${styles.bootupAnimation}`}>
          <LinuxTerminal className="w-full max-w-2xl mx-auto">
            <div className="h-80 overflow-hidden p-2">
              {bootSequence.slice(0, bootPhase + 1).map((text, index) => (
                <div key={index} className="mb-4">
                  <TypeWriter 
                    text={text} 
                    speed={40} 
                    className={index === 0 ? "text-green-400" : "text-white"}
                  />
                </div>
              ))}
              {bootPhase >= bootSequence.length - 1 && (
                <div className="mt-8">
                  <AsciiAnimation frames={catAsciiFrames} speed={300} className="text-green-400" />
                </div>
              )}
            </div>
          </LinuxTerminal>
        </div>
      )}
    </div>
  );
}

export default CATRetroTechHero;