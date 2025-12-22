/**
 * Diagnosis.jsx
 *
 * Step 7 of consultation workflow.
 * Displays AI-generated diagnosis suggestions and allows user to select/evaluate them.
 *
 * Endpoints:
 *   - GET /api/consultations/{id}/diagnosis (fetch AI suggestions)
 *   - POST /api/consultations/{id}/diagnosis (save selected diagnosis with ratings)
 *
 * Flow:
 *   Wearable → Diagnosis (CURRENT) → Exams → Completion → Dashboard
 *
 * API Response Format:
 *   {
 *     patient_id: string
 *     summary: string
 *     options: [{ name: string, description: string }, ...]
 *   }
 *
 * API Request Format:
 *   {
 *     selected_diagnoses: [name, ...],
 *     evaluations: {
 *       name: {
 *         accuracy: int (1-10),
 *         relevance: int (1-10),
 *         usefulness: int (1-10),
 *         coherence: int (1-10),
 *         comments: Optional[string]
 *       }
 *     }
 *   }
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Form,
  Button,
  Container,
  Card,
  ProgressBar,
  Alert,
  Spinner,
  ListGroup,
  Badge,
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConsultation, consultationActions } from '../../context/ConsultationContext';
import consultationAPI from '../../services/api';

export default function Diagnosis() {
  // =========================================================================
  // HOOKS
  // =========================================================================

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state, dispatch } = useConsultation();
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  // =========================================================================
  // STATE
  // =========================================================================

  const [apiError, setApiError] = useState(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [suggestions, setSuggestions] = useState(
    state.formData.diagnosis.suggestions || []
  );
  const [selectedDiagnoses, setSelectedDiagnoses] = useState(
    state.formData.diagnosis.selected || []
  );
  const [evaluations, setEvaluations] = useState(
    state.formData.diagnosis.evaluations || {}
  );

  // =========================================================================
  // EFFECTS
  // =========================================================================

  useEffect(() => {
    fetchDiagnosisSuggestions();
  }, []);

  // =========================================================================
  // API CALLS
  // =========================================================================

  const fetchDiagnosisSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      setApiError(null);

      if (!state.patientId) {
        throw new Error('Patient ID not found. Please start over.');
      }

      // Call backend API to get AI diagnosis suggestions
      // Expected response: { patient_id, summary, options: [{ name, description }, ...] }
      const response = await consultationAPI.getDiagnosisSuggestions(
        state.patientId
      );

      const diagnosisOptions = response.options || [];
      setSuggestions(diagnosisOptions);
      setAiSummary(response.summary || '');
      dispatch(consultationActions.updateDiagnosisSuggestions(diagnosisOptions));
    } catch (err) {
      console.error('Error fetching diagnosis suggestions:', err);
      setApiError(
        err.message || 'Failed to load diagnosis suggestions. Please try again.'
      );
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  const isSelected = (diagnosisName) => selectedDiagnoses.includes(diagnosisName);

  const toggleDiagnosis = (diagnosisName) => {
    setSelectedDiagnoses((prev) =>
      prev.includes(diagnosisName)
        ? prev.filter((name) => name !== diagnosisName)
        : [...prev, diagnosisName]
    );
  };

  const setEvaluation = (diagnosisName, field, value) => {
    setEvaluations((prev) => ({
      ...prev,
      [diagnosisName]: {
        ...(prev[diagnosisName] || {}),
        [field]: parseInt(value),
      },
    }));
  };

  const setComment = (diagnosisName, comment) => {
    setEvaluations((prev) => ({
      ...prev,
      [diagnosisName]: {
        ...(prev[diagnosisName] || {}),
        comments: comment,
      },
    }));
  };

  const getEvaluationScore = (diagnosisName) => {
    const evaluations = evaluations[diagnosisName];
    if (!evaluations) return 0;
    const ratings = [
      evaluations.accuracy,
      evaluations.relevance,
      evaluations.usefulness,
      evaluations.coherence,
    ];
    const validRatings = ratings.filter((r) => r !== undefined);
    if (validRatings.length === 0) return 0;
    return Math.round(
      validRatings.reduce((a, b) => a + b, 0) / validRatings.length
    );
  };

  const isEvaluationComplete = (diagnosisName) => {
    const evaluations = evaluations[diagnosisName];
    return (
      evaluations &&
      evaluations.accuracy !== undefined &&
      evaluations.relevance !== undefined &&
      evaluations.usefulness !== undefined &&
      evaluations.coherence !== undefined
    );
  };

  // =========================================================================
  // FORM SUBMISSION
  // =========================================================================

  const onSubmit = async () => {
    try {
      setApiError(null);

      if (!state.patientId) {
        throw new Error('Patient ID not found. Please start over.');
      }

      if (selectedDiagnoses.length === 0) {
        setApiError('Please select at least one diagnosis');
        return;
      }

      // Validate all selected diagnoses have complete evaluations
      const incompleteEvals = selectedDiagnoses.filter(
        (name) => !isEvaluationComplete(name)
      );
      if (incompleteEvals.length > 0) {
        setApiError(
          `Please complete ratings for: ${incompleteEvals.join(', ')}`
        );
        return;
      }

      // Update local state
      dispatch(
        consultationActions.updateSelectedDiagnosis(
          selectedDiagnoses,
          evaluations
        )
      );

      // Call backend API to save selections with ratings
      // Expected request: { selected_diagnoses: [names], evaluations: { name: DiagnosisRating, ... } }
      const response = await consultationAPI.saveDiagnosisSelections(
        state.patientId,
        {
          selected_diagnoses: selectedDiagnoses,
          evaluations: evaluations,
        }
      );

      // Navigate to exams step
      dispatch(consultationActions.setCurrentStep('exams'));
      navigate('/exams');
    } catch (err) {
      console.error('Error saving diagnosis selections:', err);
      setApiError(
        err.message || 'Failed to save selections. Please try again.'
      );
      window.scrollTo(0, 0);
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  const hasSelectedDiagnoses = selectedDiagnoses.length > 0;

  return (
    <div className="bg-light min-vh-100 py-4">
      <Container>
        {/* Progress Section */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="text-muted fw-semibold">Step 7 of 10</small>
            <small className="text-muted">70% Complete</small>
          </div>
          <ProgressBar now={70} style={{ height: '8px' }} className="mb-3" />
        </div>

        {/* Error Alert */}
        {apiError && (
          <Alert
            variant="danger"
            dismissible
            onClose={() => setApiError(null)}
            className="mb-4"
          >
            <Alert.Heading>Error</Alert.Heading>
            <p className="mb-0">{apiError}</p>
          </Alert>
        )}

        {/* Loading State */}
        {isLoadingSuggestions ? (
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-5 text-center">
              <Spinner animation="border" variant="primary" className="mb-3" />
              <p className="text-muted">
                Analyzing patient data and generating differential diagnosis suggestions...
              </p>
            </Card.Body>
          </Card>
        ) : (
          <>
            {/* Main Card */}
            <Card className="border-0 shadow-sm mb-4">
              <Card.Body className="p-4 p-md-5">
                {/* Header */}
                <div className="mb-5">
                  <h1 className="display-6 fw-bold text-primary mb-2">
                    🔬 AI Diagnostic Suggestions
                  </h1>
                  <p className="text-muted lead mb-0">
                    Review and evaluate the AI-generated differential diagnoses
                  </p>
                </div>

                {/* AI Summary */}
                {aiSummary && (
                  <Card className="bg-light border-0 mb-4">
                    <Card.Body className="p-3">
                      <p className="text-muted small mb-0">
                        <strong>AI Analysis Summary:</strong>
                      </p>
                      <p className="text-muted mt-2 mb-0">{aiSummary}</p>
                    </Card.Body>
                  </Card>
                )}

                {/* Info Alert */}
                <Alert
                  variant="info"
                  className="border-0 bg-info bg-opacity-10 mb-4"
                >
                  <div className="d-flex align-items-start">
                    <span className="me-2" style={{ fontSize: '1.2rem' }}>
                      ℹ️
                    </span>
                    <small>
                      These diagnostic suggestions are based on AI analysis of your
                      symptoms, demographics, lifestyle, and medical history. A
                      healthcare professional will review your selections and
                      confidence ratings.
                    </small>
                  </div>
                </Alert>

                {/* Suggestions List */}
                {suggestions.length === 0 ? (
                  <Alert variant="info" className="border-0">
                    <p className="mb-0">
                      No diagnosis suggestions available. Please ensure all previous
                      steps have been completed with accurate information.
                    </p>
                  </Alert>
                ) : (
                  <div className="mb-5">
                    <p className="fw-semibold mb-3">
                      Please review and rate these diagnosis suggestions:
                    </p>
                    <div className="space-y-3">
                      {suggestions.map((diagnosis, idx) => (
                        <Card
                          key={idx}
                          className={`border-2 transition ${
                            isSelected(diagnosis.name)
                              ? 'border-primary bg-primary bg-opacity-5'
                              : 'border-light'
                          }`}
                          style={{ cursor: 'pointer' }}
                        >
                          <Card.Body className="p-3">
                            <div className="d-flex gap-3">
                              {/* Checkbox */}
                              <Form.Check
                                type="checkbox"
                                checked={isSelected(diagnosis.name)}
                                onChange={() => toggleDiagnosis(diagnosis.name)}
                                className="mt-1"
                              />

                              {/* Diagnosis Info */}
                              <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                  <div>
                                    <h6 className="mb-1 fw-bold">
                                      {diagnosis.name}
                                    </h6>
                                    {diagnosis.description && (
                                      <p className="text-muted small mb-0">
                                        {diagnosis.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Expanded Details when Selected */}
                                {isSelected(diagnosis.name) && (
                                  <div className="mt-4 pt-3 border-top">
                                    <div className="mb-4">
                                      <p className="small fw-semibold mb-3">
                                        ⭐ Rate this diagnosis suggestion:
                                      </p>

                                      {/* Accuracy Rating */}
                                      <div className="mb-3">
                                        <label className="small fw-semibold mb-2 d-block">
                                          Accuracy (1-10)
                                        </label>
                                        <div className="d-flex gap-2">
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                                            (num) => (
                                              <Button
                                                key={num}
                                                size="sm"
                                                variant={
                                                  evaluations[diagnosis.name]
                                                    ?.accuracy === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    diagnosis.name,
                                                    'accuracy',
                                                    num
                                                  )
                                                }
                                              >
                                                {num}
                                              </Button>
                                            )
                                          )}
                                        </div>
                                      </div>

                                      {/* Relevance Rating */}
                                      <div className="mb-3">
                                        <label className="small fw-semibold mb-2 d-block">
                                          Relevance (1-10)
                                        </label>
                                        <div className="d-flex gap-2">
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                                            (num) => (
                                              <Button
                                                key={num}
                                                size="sm"
                                                variant={
                                                  evaluations[diagnosis.name]
                                                    ?.relevance === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    diagnosis.name,
                                                    'relevance',
                                                    num
                                                  )
                                                }
                                              >
                                                {num}
                                              </Button>
                                            )
                                          )}
                                        </div>
                                      </div>

                                      {/* Usefulness Rating */}
                                      <div className="mb-3">
                                        <label className="small fw-semibold mb-2 d-block">
                                          Usefulness (1-10)
                                        </label>
                                        <div className="d-flex gap-2">
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                                            (num) => (
                                              <Button
                                                key={num}
                                                size="sm"
                                                variant={
                                                  evaluations[diagnosis.name]
                                                    ?.usefulness === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    diagnosis.name,
                                                    'usefulness',
                                                    num
                                                  )
                                                }
                                              >
                                                {num}
                                              </Button>
                                            )
                                          )}
                                        </div>
                                      </div>

                                      {/* Coherence Rating */}
                                      <div className="mb-3">
                                        <label className="small fw-semibold mb-2 d-block">
                                          Coherence (1-10)
                                        </label>
                                        <div className="d-flex gap-2">
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                                            (num) => (
                                              <Button
                                                key={num}
                                                size="sm"
                                                variant={
                                                  evaluations[diagnosis.name]
                                                    ?.coherence === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    diagnosis.name,
                                                    'coherence',
                                                    num
                                                  )
                                                }
                                              >
                                                {num}
                                              </Button>
                                            )
                                          )}
                                        </div>
                                      </div>

                                      {/* Comments */}
                                      <div>
                                        <label className="small fw-semibold mb-2 d-block">
                                          Comments (Optional)
                                        </label>
                                        <Form.Control
                                          as="textarea"
                                          rows={2}
                                          placeholder="Add any additional comments about this diagnosis..."
                                          value={
                                            evaluations[diagnosis.name]
                                              ?.comments || ''
                                          }
                                          onChange={(e) =>
                                            setComment(diagnosis.name, e.target.value)
                                          }
                                          className="small"
                                        />
                                      </div>

                                      {/* Score Summary */}
                                      <div className="mt-3 pt-3 border-top">
                                        <small className="text-muted">
                                          Average Score:{' '}
                                          <strong>
                                            {getEvaluationScore(diagnosis.name)}/10
                                          </strong>
                                        </small>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Summary */}
                {hasSelectedDiagnoses && (
                  <Card className="bg-light border-0 mb-4">
                    <Card.Body className="p-3">
                      <p className="fw-semibold mb-2">
                        Selected Diagnoses ({selectedDiagnoses.length})
                      </p>
                      <ListGroup>
                        {selectedDiagnoses.map((diagnosisName) => {
                          const isComplete = isEvaluationComplete(diagnosisName);
                          const score = getEvaluationScore(diagnosisName);
                          return (
                            <ListGroup.Item
                              key={diagnosisName}
                              className="d-flex justify-content-between align-items-center"
                            >
                              <div>
                                <p className="mb-1">{diagnosisName}</p>
                                <small className="text-muted">
                                  Score: {score}/10
                                </small>
                              </div>
                              {isComplete ? (
                                <Badge bg="success">✓ Complete</Badge>
                              ) : (
                                <Badge bg="warning">⚠ Incomplete</Badge>
                              )}
                            </ListGroup.Item>
                          );
                        })}
                      </ListGroup>
                    </Card.Body>
                  </Card>
                )}

                {/* Guidance Alert */}
                <Alert variant="info" className="border-0 bg-info bg-opacity-10 mb-4">
                  <div className="d-flex align-items-start">
                    <span className="me-2" style={{ fontSize: '1.2rem' }}>
                      💡
                    </span>
                    <div className="small">
                      <p className="mb-2 fw-semibold">How to rate each diagnosis:</p>
                      <ul className="mb-0 ps-3">
                        <li>
                          <strong>Accuracy:</strong> How accurate is this diagnosis
                          based on your symptoms?
                        </li>
                        <li>
                          <strong>Relevance:</strong> How relevant is this diagnosis to
                          your condition?
                        </li>
                        <li>
                          <strong>Usefulness:</strong> How useful would this diagnosis
                          be for treatment?
                        </li>
                        <li>
                          <strong>Coherence:</strong> How logically coherent is this
                          diagnosis with your data?
                        </li>
                      </ul>
                    </div>
                  </div>
                </Alert>

                {/* Action Buttons */}
                <div className="d-flex justify-content-between align-items-center pt-4 border-top">
                  <Button
                    variant="outline-secondary"
                    onClick={() => navigate(-1)}
                    size="lg"
                    disabled={isSubmitting}
                  >
                    ← Back
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={
                      isSubmitting ||
                      !hasSelectedDiagnoses ||
                      selectedDiagnoses.some(
                        (name) => !isEvaluationComplete(name)
                      )
                    }
                    onClick={handleSubmit(onSubmit)}
                    className="d-flex align-items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner animation="border" size="sm" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>Next: Recommended Exams</span>
                        <span>→</span>
                      </>
                    )}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </>
        )}

        {/* Footer */}
        <div className="text-center mt-4">
          <small className="text-muted">
            Your ratings help improve AI diagnostic accuracy for future patients
          </small>
        </div>
      </Container>
    </div>
  );
}
