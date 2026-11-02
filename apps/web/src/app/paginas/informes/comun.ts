/** Cifras destacadas sobre la grilla de los informes (como en las cuentas de conductores). */
export const ESTILOS_INFORME = `
  .filtros {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .cliente {
    width: 16rem;
  }
  .resumen {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .cifra {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: var(--nt-radio);
    box-shadow: var(--nt-tarjeta-sombra);
    padding: 1rem 1.25rem;
    span {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--p-text-muted-color);
    }
    strong {
      display: block;
      font-size: 1.5rem;
      margin-top: 0.25rem;
      font-variant-numeric: tabular-nums;
    }
    small {
      color: var(--p-text-muted-color);
    }
  }
  .favor strong {
    color: var(--p-primary-color);
  }
  .contra strong {
    color: var(--nt-alerta);
  }
  .estados {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }
`;
