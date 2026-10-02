import { useState } from 'react';

const PADDING_GAUCHE = 30;
const PADDING_DROITE = 12;
const PADDING_HAUT = 16;
const PADDING_BAS = 28;
const HAUTEUR = 220;
const LARGEUR_COLONNE = 96;
const LARGEUR_BARRE = 24;

function calculerPaliers(valeurMax) {
  const max = Math.max(4, valeurMax);
  const pas = Math.max(1, Math.ceil(max / 4));
  const paliers = [];
  for (let v = 0; v <= max; v += pas) paliers.push(v);
  if (paliers[paliers.length - 1] !== max) paliers.push(max);
  return { max: paliers[paliers.length - 1], paliers };
}

function BarChart({ data }) {
  const [survole, setSurvole] = useState(null);

  const valeurMax = Math.max(0, ...data.map((d) => d.value));
  const { max, paliers } = calculerPaliers(valeurMax);
  const largeur = PADDING_GAUCHE + PADDING_DROITE + data.length * LARGEUR_COLONNE;
  const hauteurTrace = HAUTEUR - PADDING_HAUT - PADDING_BAS;

  const item = survole !== null ? data[survole] : null;

  return (
    <div className="bar-chart">
      <svg
        width="100%"
        height={HAUTEUR}
        viewBox={`0 0 ${largeur} ${HAUTEUR}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Graphique en barres"
      >
        {paliers.map((v) => {
          const y = PADDING_HAUT + hauteurTrace - (v / max) * hauteurTrace;
          return (
            <g key={v}>
              <line
                x1={PADDING_GAUCHE}
                y1={y}
                x2={largeur - PADDING_DROITE}
                y2={y}
                className="bar-chart-grille"
              />
              <text x={PADDING_GAUCHE - 8} y={y} textAnchor="end" dominantBaseline="middle" className="bar-chart-axe">
                {v}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const centreColonne = PADDING_GAUCHE + i * LARGEUR_COLONNE + LARGEUR_COLONNE / 2;
          const hauteurBarre = max > 0 ? (d.value / max) * hauteurTrace : 0;
          const xBarre = centreColonne - LARGEUR_BARRE / 2;
          const yBarre = PADDING_HAUT + hauteurTrace - hauteurBarre;

          return (
            <g key={d.label}>
              <rect
                x={PADDING_GAUCHE + i * LARGEUR_COLONNE}
                y={PADDING_HAUT}
                width={LARGEUR_COLONNE}
                height={hauteurTrace}
                fill="transparent"
                onMouseEnter={() => setSurvole(i)}
                onMouseLeave={() => setSurvole(null)}
                onFocus={() => setSurvole(i)}
                onBlur={() => setSurvole(null)}
                tabIndex={0}
                role="img"
                aria-label={`${d.label} : ${d.value}`}
              />
              {hauteurBarre > 0 && (
                <>
                  <rect
                    x={xBarre}
                    y={yBarre}
                    width={LARGEUR_BARRE}
                    height={hauteurBarre}
                    rx={4}
                    ry={4}
                    className={`bar-chart-barre ${survole === i ? 'survolee' : ''}`}
                    pointerEvents="none"
                  />
                  <rect
                    x={xBarre}
                    y={PADDING_HAUT + hauteurTrace - Math.min(4, hauteurBarre)}
                    width={LARGEUR_BARRE}
                    height={Math.min(4, hauteurBarre)}
                    className={`bar-chart-barre ${survole === i ? 'survolee' : ''}`}
                    pointerEvents="none"
                  />
                </>
              )}
              <text
                x={centreColonne}
                y={HAUTEUR - PADDING_BAS + 18}
                textAnchor="middle"
                className="bar-chart-axe"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {item && (
        <div
          className="chart-tooltip"
          style={{
            left: `${((PADDING_GAUCHE + survole * LARGEUR_COLONNE + LARGEUR_COLONNE / 2) / largeur) * 100}%`,
            top: `${PADDING_HAUT + hauteurTrace - (max > 0 ? (item.value / max) * hauteurTrace : 0)}px`,
          }}
        >
          <strong>{item.label}</strong>
          <span>count : {item.value}</span>
        </div>
      )}
    </div>
  );
}

export default BarChart;
