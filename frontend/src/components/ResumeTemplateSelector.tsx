import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { Checkbox, ButtonGroup, Toggle, Button, LinearProgressBar, Flex, Heading, Text } from '@vibe/core';

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
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set(['professional']));
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [saveToSharePoint, setSaveToSharePoint] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [currentTemplate, setCurrentTemplate] = useState<string>('');

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

  const handleTemplateToggle = (templateId: string, available: boolean) => {
    if (!available) return;

    setSelectedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  const handleGenerate = async () => {
    if (selectedTemplates.size === 0) {
      setError('Please select at least one template');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(0);

    const templateArray = Array.from(selectedTemplates);
    const totalTemplates = templateArray.length;
    let completedTemplates = 0;
    let lastSharepointUrl: string | undefined;

    try {
      for (const templateId of templateArray) {
        setCurrentTemplate(templateId);

        // Update progress for current template
        const baseProgress = (completedTemplates / totalTemplates) * 100;
        const templateProgress = 100 / totalTemplates;

        // Simulate progress within each template generation
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            const maxForThisTemplate = baseProgress + (templateProgress * 0.9);
            return Math.min(prev + 2, maxForThisTemplate);
          });
        }, 500);

        const response = await apiService.generateResumeWithTemplate(
          candidateId,
          templateId,
          saveToSharePoint,
          selectedFormat as 'pdf' | 'docx'
        );

        clearInterval(progressInterval);
        completedTemplates++;
        setProgress((completedTemplates / totalTemplates) * 100);

        // Get SharePoint URL from response header if available
        const sharepointUrl = response.headers['x-sharepoint-url'];
        if (sharepointUrl) {
          lastSharepointUrl = sharepointUrl;
        }

        // Create download link for PDF or DOCX
        const mimeType = selectedFormat === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const fileExtension = selectedFormat === 'pdf' ? 'pdf' : 'docx';
        const blob = new Blob([response.data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Include template name in filename for multi-template downloads
        const templateName = templateId === 'professional' ? 'cendien' : templateId;
        link.download = `improved_resume_${templateName}_${candidateName.replace(/\s+/g, '_')}.${fileExtension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      if (onGenerate) {
        onGenerate(lastSharepointUrl);
      }

    } catch (err: any) {
      console.error('Failed to generate resume:', err);
      setError(err.response?.data?.error || 'Failed to generate resume');
    } finally {
      setLoading(false);
      setCurrentTemplate('');
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const formatOptions = [
    { value: 'pdf', text: 'PDF' },
    { value: 'docx', text: 'DOCX' }
  ];

  const availableTemplates = templates.filter(t => t.available);
  const hasAvailableTemplates = availableTemplates.some(t =>
    t.id === 'professional' || t.id === 'modern' || t.id === 'minimal'
  );

  return (
    <div className="bg-gray-50 p-5 mt-5">
      <Heading type="h3" className="mb-5 text-gray-800">Generate Improved Resume</Heading>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Template Selection */}
      <div className="mb-5">
        <Text type="text1" weight="bold" className="mb-3 text-gray-600 block">
          Select Templates:
        </Text>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`
                p-4 border-2 bg-white transition-all
                ${selectedTemplates.has(template.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                ${template.available ? 'cursor-pointer hover:border-blue-300' : 'opacity-50 cursor-not-allowed'}
              `}
              onClick={() => handleTemplateToggle(template.id, template.available)}
            >
              <Flex gap="small" align="start">
                <Checkbox
                  checked={selectedTemplates.has(template.id)}
                  disabled={!template.available}
                  onChange={() => handleTemplateToggle(template.id, template.available)}
                  className="mt-1"
                />
                <div className="flex-1">
                  {template.preview_image && (
                    <div className="mb-3 rounded overflow-hidden bg-gray-100">
                      <img
                        src={template.preview_image}
                        alt={`${template.name} preview`}
                        className="w-full h-auto border border-gray-200"
                      />
                    </div>
                  )}
                  <Text type="text1" weight="bold" className="text-gray-800 mb-2 block">
                    {template.name}
                  </Text>
                  {template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {!template.available && (
                    <div className="mt-2 px-2 py-1 bg-yellow-400 text-black text-xs font-bold text-center">
                      Coming Soon
                    </div>
                  )}
                </div>
              </Flex>
            </div>
          ))}
        </div>
        {selectedTemplates.size > 0 && (
          <Text type="text2" className="mt-2 text-gray-500">
            {selectedTemplates.size} template{selectedTemplates.size > 1 ? 's' : ''} selected
          </Text>
        )}
      </div>

      {/* Format Selection */}
      {hasAvailableTemplates && selectedTemplates.size > 0 && (
        <div className="mb-5">
          <Text type="text1" weight="bold" className="mb-3 text-gray-600 block">
            Output Format:
          </Text>
          <ButtonGroup
            options={formatOptions}
            value={selectedFormat}
            onSelect={(value) => setSelectedFormat(value as string)}
            size="small"
          />
        </div>
      )}

      {/* SharePoint Toggle */}
      <div className="mb-5">
        <Flex gap="small" align="center">
          <Toggle
            isSelected={saveToSharePoint}
            onChange={(value) => setSaveToSharePoint(value)}
            size="small"
            areLabelsHidden
          />
          <Text type="text2" className="text-gray-600">
            Save to SharePoint (job position folder)
          </Text>
        </Flex>
      </div>

      {/* Progress Bar */}
      {loading && progress > 0 && (
        <div className="mb-4">
          <LinearProgressBar
            value={progress}
            size="medium"
            barStyle="positive"
          />
          <Text type="text2" className="mt-2 text-center text-gray-600">
            {currentTemplate && `Generating ${currentTemplate}... `}
            {Math.round(progress)}%
          </Text>
        </div>
      )}

      {/* Actions */}
      <Flex justify="end">
        <Button
          onClick={handleGenerate}
          disabled={loading || selectedTemplates.size === 0}
          size="small"
          loading={loading}
        >
          {loading
            ? `Generating ${selectedTemplates.size > 1 ? `(${selectedTemplates.size} templates)` : ''}...`
            : `Generate${selectedTemplates.size > 1 ? ` (${selectedTemplates.size})` : ''}`
          }
        </Button>
      </Flex>
    </div>
  );
};

export default ResumeTemplateSelector;
