import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

interface Template {
  id: string;
  name: string;
  description: string;
  preview_image: string | null;
  tags: string[];
  available: boolean;
}

interface ResumeTemplateSelectorProps {
  candidateId: string;
  candidateName: string;
  onGenerate?: (sharepointUrl?: string) => void;
}

const ResumeTemplateSelector: React.FC<ResumeTemplateSelectorProps> = ({
  candidateId,
  candidateName,
  onGenerate
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('professional');
  const [saveToSharePoint, setSaveToSharePoint] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await apiService.getResumeTemplates();
      setTemplates(response.templates);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiService.generateResumeWithTemplate(
        candidateId,
        selectedTemplate,
        saveToSharePoint
      );

      // Get SharePoint URL from response header if available
      const sharepointUrl = response.headers['x-sharepoint-url'];

      // Create download link for PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `improved_resume_${candidateName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (onGenerate) {
        onGenerate(sharepointUrl);
      }

      if (sharepointUrl) {
        alert(`Resume saved to SharePoint!\nURL: ${sharepointUrl}`);
      }

    } catch (err: any) {
      console.error('Failed to generate resume:', err);
      setError(err.response?.data?.error || 'Failed to generate resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resume-template-selector" style={styles.container}>
      <h3 style={styles.title}>Generate Improved Resume</h3>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      <div style={styles.section}>
        <label style={styles.label}>Select Template:</label>
        <div style={styles.templateGrid}>
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => template.available && setSelectedTemplate(template.id)}
              style={{
                ...styles.templateCard,
                ...(selectedTemplate === template.id ? styles.templateCardSelected : {}),
                ...(template.available ? {} : styles.templateCardDisabled),
              }}
            >
              {template.preview_image && (
                <div style={styles.previewImageContainer}>
                  <img
                    src={template.preview_image}
                    alt={`${template.name} preview`}
                    style={styles.previewImage}
                  />
                </div>
              )}
              <div style={styles.templateName}>{template.name}</div>
              {template.tags.length > 0 && (
                <div style={styles.tags}>
                  {template.tags.map((tag) => (
                    <span key={tag} style={styles.tag}>{tag}</span>
                  ))}
                </div>
              )}
              {!template.available && (
                <div style={styles.comingSoon}>Coming Soon</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={saveToSharePoint}
            onChange={(e) => setSaveToSharePoint(e.target.checked)}
            style={styles.checkbox}
          />
          Save to SharePoint (job position folder)
        </label>
      </div>

      <div style={styles.actions}>
        <button
          onClick={handleGenerate}
          disabled={loading || !selectedTemplate}
          style={{
            ...styles.button,
            ...(loading || !selectedTemplate ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? 'Generating...' : 'Start'}
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    marginTop: '20px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#333',
  },
  section: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#555',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '15px',
  },
  templateCard: {
    padding: '15px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: '8px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s',
    overflow: 'hidden',
  },
  previewImageContainer: {
    marginBottom: '12px',
    borderRadius: '4px',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  previewImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
    border: '1px solid #e0e0e0',
  },
  templateCardSelected: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  templateCardDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  templateName: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#333',
  },
  templateDescription: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '10px',
    lineHeight: '1.4',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
  },
  tag: {
    padding: '3px 8px',
    fontSize: '11px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    color: '#555',
  },
  comingSoon: {
    marginTop: '10px',
    padding: '5px',
    backgroundColor: '#ffc107',
    color: '#000',
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'center',
    borderRadius: '4px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    color: '#555',
    cursor: 'pointer',
  },
  checkbox: {
    marginRight: '8px',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  error: {
    padding: '10px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    marginBottom: '15px',
  },
};

export default ResumeTemplateSelector;
