import React, { useState, useEffect } from 'react';
import SwissGridView from './components/SwissGridView';
import { COHORT_PRESETS, RECOMMENDATIONS, TRADITIONAL_BASELINES, ABLATION_STUDIES, LATENT_EMBEDDING_SAMPLES } from './data';

export default function App() {
  const [selectedCohortId, setSelectedCohortId] = useState('divergent-1800');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);

  const selectedCohort = COHORT_PRESETS.find(c => c.id === selectedCohortId) || COHORT_PRESETS[0];

  useEffect(() => {
    if (isSimulating) {
      if (simulationStep < 4) {
        const timer = setTimeout(() => setSimulationStep(p => p + 1), 700);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setIsSimulating(false);
          setSimulationStep(0);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isSimulating, simulationStep]);

  return (
    <SwissGridView
      selectedCohort={selectedCohort}
      cohorts={COHORT_PRESETS}
      onSelectCohort={setSelectedCohortId}
      recommendations={RECOMMENDATIONS}
      baselineMovies={TRADITIONAL_BASELINES}
      ablationMethods={ABLATION_STUDIES}
      latentSeeds={LATENT_EMBEDDING_SAMPLES}
      isSimulating={isSimulating}
      onRunSimulation={() => {
        setIsSimulating(true);
        setSimulationStep(1);
      }}
      simulationStep={simulationStep}
    />
  );
}