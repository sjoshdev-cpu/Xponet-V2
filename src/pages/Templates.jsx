import React from 'react';
import { Page } from '@/api/firestoreClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

const TEMPLATES = [
  {
    name: 'Meeting Notes',
    icon: '📝',
    description: 'Structured notes for meetings with agenda and action items',
    blocks: [
      { id: '1', type: 'heading2', content: 'Meeting Details' },
      { id: '2', type: 'bullet', content: 'Date: ' },
      { id: '3', type: 'bullet', content: 'Attendees: ' },
      { id: '4', type: 'bullet', content: 'Type: ' },
      { id: '5', type: 'divider' },
      { id: '6', type: 'heading2', content: 'Agenda' },
      { id: '7', type: 'numbered', content: '' },
      { id: '8', type: 'divider' },
      { id: '9', type: 'heading2', content: 'Notes' },
      { id: '10', type: 'paragraph', content: '' },
      { id: '11', type: 'divider' },
      { id: '12', type: 'heading2', content: 'Action Items' },
      { id: '13', type: 'todo', checked: false, content: '' },
    ]
  },
  {
    name: 'Project Brief',
    icon: '📊',
    description: 'Outline for a new project with goals and timeline',
    blocks: [
      { id: '1', type: 'heading2', content: 'Overview' },
      { id: '2', type: 'paragraph', content: '' },
      { id: '3', type: 'heading2', content: 'Goals' },
      { id: '4', type: 'bullet', content: '' },
      { id: '5', type: 'heading2', content: 'Timeline' },
      { id: '6', type: 'paragraph', content: '' },
      { id: '7', type: 'heading2', content: 'Team' },
      { id: '8', type: 'bullet', content: '' },
      { id: '9', type: 'heading2', content: 'Success Metrics' },
      { id: '10', type: 'bullet', content: '' },
    ]
  },
  {
    name: 'Weekly Update',
    icon: '📅',
    description: 'Weekly progress report template',
    blocks: [
      { id: '1', type: 'heading2', content: 'Highlights' },
      { id: '2', type: 'bullet', content: '' },
      { id: '3', type: 'heading2', content: 'Completed This Week' },
      { id: '4', type: 'todo', checked: true, content: '' },
      { id: '5', type: 'heading2', content: 'In Progress' },
      { id: '6', type: 'todo', checked: false, content: '' },
      { id: '7', type: 'heading2', content: 'Planned for Next Week' },
      { id: '8', type: 'bullet', content: '' },
      { id: '9', type: 'heading2', content: 'Blockers' },
      { id: '10', type: 'callout', emoji: '⚠️', color: 'yellow', content: '' },
    ]
  },
  {
    name: 'Decision Log',
    icon: '⚖️',
    description: 'Record important decisions and their context',
    blocks: [
      { id: '1', type: 'heading2', content: 'Decision' },
      { id: '2', type: 'callout', emoji: '📌', color: 'blue', content: '' },
      { id: '3', type: 'heading2', content: 'Context' },
      { id: '4', type: 'paragraph', content: '' },
      { id: '5', type: 'heading2', content: 'Options Considered' },
      { id: '6', type: 'numbered', content: '' },
      { id: '7', type: 'heading2', content: 'Rationale' },
      { id: '8', type: 'paragraph', content: '' },
      { id: '9', type: 'heading2', content: 'Impact' },
      { id: '10', type: 'paragraph', content: '' },
    ]
  },
  {
    name: 'Bug Report',
    icon: '🐛',
    description: 'Detailed bug report template',
    blocks: [
      { id: '1', type: 'heading2', content: 'Summary' },
      { id: '2', type: 'paragraph', content: '' },
      { id: '3', type: 'heading2', content: 'Steps to Reproduce' },
      { id: '4', type: 'numbered', content: '' },
      { id: '5', type: 'heading2', content: 'Expected Behavior' },
      { id: '6', type: 'paragraph', content: '' },
      { id: '7', type: 'heading2', content: 'Actual Behavior' },
      { id: '8', type: 'paragraph', content: '' },
      { id: '9', type: 'heading2', content: 'Environment' },
      { id: '10', type: 'bullet', content: 'OS: ' },
      { id: '11', type: 'bullet', content: 'Browser: ' },
      { id: '12', type: 'bullet', content: 'Version: ' },
    ]
  },
  {
    name: 'Retrospective',
    icon: '🔄',
    description: 'Team retrospective with what worked and improvements',
    blocks: [
      { id: '1', type: 'heading2', content: 'What Went Well ✅' },
      { id: '2', type: 'bullet', content: '' },
      { id: '3', type: 'heading2', content: 'What Could Be Improved 🔧' },
      { id: '4', type: 'bullet', content: '' },
      { id: '5', type: 'heading2', content: 'Action Items' },
      { id: '6', type: 'todo', checked: false, content: '' },
      { id: '7', type: 'heading2', content: 'Shoutouts 🎉' },
      { id: '8', type: 'paragraph', content: '' },
    ]
  },
];

export default function Templates() {
  const { currentOrg } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createFromTemplate = useMutation({
    mutationFn: (template) => Page.create({
      title: template.name,
      icon: template.icon,
      org_id: currentOrg?.id,
      content: JSON.stringify(template.blocks),
    }),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      navigate(`/page/${page.id}`);
    }
  });

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Templates</h1>
      <p className="text-muted-foreground mb-8">Get started quickly with pre-built templates</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map(template => (
          <button
            key={template.name}
            onClick={() => createFromTemplate.mutate(template)}
            className="group text-left p-5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all"
          >
            <div className="text-3xl mb-3">{template.icon}</div>
            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
              {template.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {template.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}