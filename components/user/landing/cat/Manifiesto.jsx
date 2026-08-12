"use client";
import { useState, useEffect, useRef } from "react";
import styles from "./Manifiesto.module.css";

function Manifiesto({
  // Mensaje principal
  mensajePrincipal = "Innovación con propósito",
  // Línea secundaria (ej. la visión)
  mensajeSecundario = "Creando un ecosistema donde la tecnología sea una herramienta de inclusión y progreso para la comunidad.",
  // Duración de la animación de typing (segundos)
  duracionAnimacion = 0.8,
  // Umbral para la activación por scroll (0-1)
  umbralScroll = 0.3
}) {
  const [animacionCompletada, setAnimacionCompletada] = useState(false);
  const [mostrarSecundario, setMostrarSecundario] = useState(false);
  const [animacionIniciada, setAnimacionIniciada] = useState(false);
  const sectionRef = useRef(null);
  
  // Configurar el observer para detectar cuando la sección es visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !animacionIniciada) {
          setAnimacionIniciada(true);
        }
      },
      {
        threshold: umbralScroll, // Porcentaje del elemento visible para activar
        rootMargin: '0px' // Margen adicional alrededor del elemento
      }
    );
    
    const currentRef = sectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    // Limpieza
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [umbralScroll, animacionIniciada]);
  
  // Efecto para mostrar el mensaje secundario después de completar el principal
  useEffect(() => {
    if (animacionCompletada) {
      const timer = setTimeout(() => {
        setMostrarSecundario(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [animacionCompletada]);
  
  // Simulación del efecto de typing para el mensaje principal
  useEffect(() => {
    if (!animacionIniciada) return;
    
    const texto = document.getElementById('texto-principal');
    if (!texto) return;
    
    const contenido = mensajePrincipal;
    let index = 0;
    texto.textContent = '';
    
    const interval = setInterval(() => {
      if (index < contenido.length) {
        texto.textContent += contenido.charAt(index);
        index++;
      } else {
        clearInterval(interval);
        setAnimacionCompletada(true);
      }
    }, (duracionAnimacion * 1000) / contenido.length);
    
    return () => clearInterval(interval);
  }, [mensajePrincipal, duracionAnimacion, animacionIniciada]);
  
  // Simulación del efecto de typing para el mensaje secundario
  useEffect(() => {
    if (!mostrarSecundario) return;
    
    const texto = document.getElementById('texto-secundario');
    if (!texto) return;
    
    const contenido = mensajeSecundario;
    let index = 0;
    texto.textContent = '';
    
    const interval = setInterval(() => {
      if (index < contenido.length) {
        texto.textContent += contenido.charAt(index);
        index++;
      } else {
        clearInterval(interval);
      }
    }, (duracionAnimacion * 1.2 * 1000) / contenido.length);
    
    return () => clearInterval(interval);
  }, [mensajeSecundario, duracionAnimacion, mostrarSecundario]);
  
  return (
    <section ref={sectionRef} className={styles.manifiestoSection}>
      <div className={styles.decorationCode}>&lt;/&gt;</div>
      
      {/* Terminal hacker simplificada */}
      <div className={`${styles.terminalContainer} ${animacionIniciada ? styles.terminalVisible : ''}`}>
        {/* Header de la terminal */}
        <div className={styles.terminalHeader}>
          <div className={styles.terminalButtons}>
            <span className={styles.closeBtn}></span>
            <span className={styles.minimizeBtn}></span>
            <span className={styles.maximizeBtn}></span>
          </div>
          <div className={styles.terminalTitle}>cat@argentina:~/manifesto$ ./hackear_futuro.sh</div>
        </div>
        
        {/* Contenido de la terminal simplificado */}
        <div className={styles.terminalContent}>
          {/* Prefijo de comando para el mensaje principal */}
          <div className={styles.prompt}>
            <span className={styles.promptUser}>cat@argentina</span>
            <span className={styles.promptSeparator}>:</span>
            <span className={styles.promptDir}>~/manifesto</span>
            <span className={styles.promptSymbol}>$ </span>
            <span>echo "$MANIFIESTO"</span>
          </div>
          
          {/* Mensaje principal con efecto typing */}
          <div className={styles.mensaje}>
            <span id="texto-principal" className={styles.mensajePrincipal}></span>
            <span className={`${styles.cursor} ${animacionCompletada ? styles.cursorLento : ''}`}>▋</span>
          </div>
          
          {/* Mensaje secundario (aparece después) */}
          {mostrarSecundario && (
            <>
              <div className={styles.prompt}>
                <span className={styles.promptUser}>cat@argentina</span>
                <span className={styles.promptSeparator}>:</span>
                <span className={styles.promptDir}>~/manifesto</span>
                <span className={styles.promptSymbol}>$ </span>
                <span>cat vision.txt</span>
              </div>
              <div className={styles.mensaje}>
                <span id="texto-secundario" className={styles.mensajeSecundario}></span>
                <span className={styles.cursor}>▋</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Elementos decorativos más sutiles */}
      <div className={styles.decorationContainer}>
        <div className={`${styles.decorationFlag} ${animacionIniciada ? styles.decorVisible : ''}`}>🇦🇷</div>
        <div className={`${styles.decorationMate} ${animacionIniciada ? styles.decorVisible : ''}`}>🧉</div>
      </div>
    </section>
  );
}

export default Manifiesto;