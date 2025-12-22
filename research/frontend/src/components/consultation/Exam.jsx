/**
 * Exams.jsx
 *
 * Step 8 of consultation workflow.
 * Displays AI-generated exam suggestions and allows user to select/evaluate them.
 * This is the FINAL STEP before consultation completion.
 *
 * Endpoints:
 *   - GET /api/consultations/{id}/exams (fetch AI suggestions)
 *   - POST /api/consultations/{id}/exams (save selected exams with ratings and finalize)
 *
 * Flow:
 *   Diagnosis → Exams (CURRENT) → Completion → Dashboard
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
 *     selected_exams: [name, ...],
 *     evaluations: {
 *       name: {
 *         accuracy: int (1-10),
 *         relevance: int (1-10),
 *         usefulness: int (1-10),
 *         coherence: int (1-10),
 *         safety: int (1-10),
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

export default function Exams() {
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
    state.formData.exams.suggestions || []
  );
  const [selectedExams, setSelectedExams] = useState(
    state.formData.exams.selected || []
  );
  const [evaluations, setEvaluations] = useState(
    state.formData.exams.evaluations || {}
  );

  // =========================================================================
  // EFFECTS
  // =========================================================================

  useEffect(() => {
    fetchExamSuggestions();
  }, []);

  // =========================================================================
  // API CALLS
  // =========================================================================

  const fetchExamSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      setApiError(null);

      if (!state.patientId) {
        throw new Error('Patient ID not found. Please start over.');
      }

      // Call backend API to get AI exam suggestions
      // Expected response: { patient_id, summary, options: [{ name, description }, ...] }
      const response = await consultationAPI.getExamSuggestions(state.patientId);

      const examOptions = response.options || [];
      setSuggestions(examOptions);
      setAiSummary(response.summary || '');
      dispatch(consultationActions.updateExamSuggestions(examOptions));
    } catch (err) {
      console.error('Error fetching exam suggestions:', err);
      setApiError(
        err.message || 'Failed to load exam suggestions. Please try again.'
      );
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  const isSelected = (examName) => selectedExams.includes(examName);

  const toggleExam = (examName) => {
    setSelectedExams((prev) =>
      prev.includes(examName)
        ? prev.filter((name) => name !== examName)
        : [...prev, examName]
    );
  };

  const setEvaluation = (examName, field, value) => {
    setEvaluations((prev) => ({
      ...prev,
      [examName]: {
        ...(prev[examName] || {}),
        [field]: parseInt(value),
      },
    }));
  };

  const setComment = (examName, comment) => {
    setEvaluations((prev) => ({
      ...prev,
      [examName]: {
        ...(prev[examName] || {}),
        comments: comment,
      },
    }));
  };

  const getEvaluationScore = (examName) => {
    const evaluations = evaluations[examName];
    if (!evaluations) return 0;
    const ratings = [
      evaluations.accuracy,
      evaluations.relevance,
      evaluations.usefulness,
      evaluations.coherence,
      evaluations.safety,
    ];
    const validRatings = ratings.filter((r) => r !== undefined);
    if (validRatings.length === 0) return 0;
    return Math.round(
      validRatings.reduce((a, b) => a + b, 0) / validRatings.length
    );
  };

  const isEvaluationComplete = (examName) => {
    const evaluations = evaluations[examName];
    return (
      evaluations &&
      evaluations.accuracy !== undefined &&
      evaluations.relevance !== undefined &&
      evaluations.usefulness !== undefined &&
      evaluations.coherence !== undefined &&
      evaluations.safety !== undefined
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

      if (selectedExams.length === 0) {
        setApiError('Please select at least one exam');
        return;
      }

      // Validate all selected exams have complete evaluations
      const incompleteEvals = selectedExams.filter(
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
        consultationActions.updateSelectedExams(selectedExams, evaluations)
      );

      // Update consultation as complete
      dispatch(consultationActions.completeConsultation());

      // Call backend API to save selections with ratings and finalize
      // This is the FINAL submission - deidentification happens on backend
      // Expected request: { selected_exams: [name, ...], evaluations: { name: ExamRating, ... } }
      const response = await consultationAPI.saveExamSelections(state.patientId, {
        selected_exams: selectedExams,
        evaluations: evaluations,
      });

      // Navigate to completion/summary page
      navigate('/completion', {
        state: {
          patientId: state.patientId,
          isComplete: response.is_complete,
        },
      });
    } catch (err) {
      console.error('Error saving exam selections:', err);
      setApiError(
        err.message || 'Failed to save selections. Please try again.'
      );
      window.scrollTo(0, 0);
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  const hasSelectedExams = selectedExams.length > 0;

  return (
    <div className="bg-light min-vh-100 py-4">
      <Container>
        {/* Progress Section */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="text-muted fw-semibold">Step 8 of 10</small>
            <small className="text-muted">80% Complete</small>
          </div>
          <ProgressBar now={80} style={{ height: '8px' }} className="mb-3" />
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
                Generating recommended tests and exams based on selected diagnoses...
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
                    🧪 Recommended Exams & Tests
                  </h1>
                  <p className="text-muted lead mb-0">
                    AI-suggested tests and exams based on selected diagnoses
                  </p>
                </div>

                {/* AI Summary */}
                {aiSummary && (
                  <Card className="bg-light border-0 mb-4">
                    <Card.Body className="p-3">
                      <p className="text-muted small mb-0">
                        <strong>AI Recommendations Summary:</strong>
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
                      These exam recommendations are based on AI analysis and selected
                      diagnoses. A healthcare professional will review and approve
                      these recommendations before proceeding with testing.
                    </small>
                  </div>
                </Alert>

                {/* Suggestions List */}
                {suggestions.length === 0 ? (
                  <Alert variant="info" className="border-0">
                    <p className="mb-0">
                      No additional exams are recommended at this time. Please proceed
                      to complete your consultation.
                    </p>
                  </Alert>
                ) : (
                  <div className="mb-5">
                    <p className="fw-semibold mb-3">
                      Please review and rate these exam recommendations:
                    </p>
                    <div className="space-y-3">
                      {suggestions.map((exam, idx) => (
                        <Card
                          key={idx}
                          className={`border-2 transition ${
                            isSelected(exam.name)
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
                                checked={isSelected(exam.name)}
                                onChange={() => toggleExam(exam.name)}
                                className="mt-1"
                              />

                              {/* Exam Info */}
                              <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                  <div>
                                    <h6 className="mb-1 fw-bold">
                                      {exam.name}
                                    </h6>
                                    {exam.description && (
                                      <p className="text-muted small mb-0">
                                        {exam.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Expanded Details when Selected */}
                                {isSelected(exam.name) && (
                                  <div className="mt-4 pt-3 border-top">
                                    <div className="mb-4">
                                      <p className="small fw-semibold mb-3">
                                        📋 Rate this exam recommendation:
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
                                                  evaluations[exam.name]
                                                    ?.accuracy === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    exam.name,
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
                                                  evaluations[exam.name]
                                                    ?.relevance === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    exam.name,
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
                                                  evaluations[exam.name]
                                                    ?.usefulness === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    exam.name,
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
                                                  evaluations[exam.name]
                                                    ?.coherence === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    exam.name,
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

                                      {/* Safety Rating (UNIQUE TO EXAMS) */}
                                      <div className="mb-3">
                                        <label className="small fw-semibold mb-2 d-block">
                                          Safety (1-10)
                                        </label>
                                        <div className="d-flex gap-2">
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                                            (num) => (
                                              <Button
                                                key={num}
                                                size="sm"
                                                variant={
                                                  evaluations[exam.name]
                                                    ?.safety === num
                                                    ? 'primary'
                                                    : 'outline-secondary'
                                                }
                                                onClick={() =>
                                                  setEvaluation(
                                                    exam.name,
                                                    'safety',
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
                                          placeholder="Add any additional comments..."
                                          value={
                                            evaluations[exam.name]?.comments || ''
                                          }
                                          onChange={(e) =>
                                            setComment(exam.name, e.target.value)
                                          }
                                          className="small"
                                        />
                                      </div>

                                      {/* Score Summary */}
                                      <div className="mt-3 pt-3 border-top">
                                        <small className="text-muted">
                                          Average Score:{' '}
                                          <strong>
                                            {getEvaluationScore(exam.name)}/10
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
                {hasSelectedExams && (
                  <Card className="bg-light border-0 mb-4">
                    <Card.Body className="p-3">
                      <p className="fw-semibold mb-2">
                        Selected Exams ({selectedExams.length})
                      </p>
                      <ListGroup>
                        {selectedExams.map((examName) => {
                          const isComplete = isEvaluationComplete(examName);
                          const score = getEvaluationScore(examName);
                          return (
                            <ListGroup.Item
                              key={examName}
                              className="d-flex justify-content-between align-items-center"
                            >
                              <div>
                                <p className="mb-1">{examName}</p>
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
                      <p className="mb-2 fw-semibold">How to rate each exam:</p>
                      <ul className="mb-0 ps-3">
                        <li>
                          <strong>Accuracy:</strong> How accurate is this exam for
                          the selected diagnoses?
                        </li>
                        <li>
                          <strong>Relevance:</strong> How relevant is this test to
                          the patient's condition?
                        </li>
                        <li>
                          <strong>Usefulness:</strong> How useful is this for
                          diagnosis confirmation?
                        </li>
                        <li>
                          <strong>Coherence:</strong> How logically coherent is this
                          exam choice?
                        </li>
                        <li>
                          <strong>Safety:</strong> How safe is this exam for the
                          patient?
                        </li>
                      </ul>
                    </div>
                  </div>
                </Alert>

                {/* Final Step Alert */}
                <Alert variant="success" className="border-0 bg-success bg-opacity-10 mb-4">
                  <div className="d-flex align-items-start">
                    <span className="me-2" style={{ fontSize: '1.2rem' }}>
                      ✅
                    </span>
                    <small>
                      This is the final step of your consultation. After submission,
                      your data will be deidentified and securely archived for
                      research purposes.
                    </small>
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
                    variant="success"
                    size="lg"
                    disabled={
                      isSubmitting ||
                      !hasSelectedExams ||
                      selectedExams.some((name) => !isEvaluationComplete(name))
                    }
                    onClick={handleSubmit(onSubmit)}
                    className="d-flex align-items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner animation="border" size="sm" />
                        <span>Finalizing Consultation...</span>
                      </>
                    ) : (
                      <>
                        <span>✓ Complete Consultation</span>
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
            Your consultation data is protected and will be deidentified upon final submission
          </small>
        </div>
      </Container>
    </div>
  );
}
