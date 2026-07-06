'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Service, ServiceItem, ServiceAssignment, TeamMember } from '@/lib/types';

interface PrintData {
  service: Service;
  items: ServiceItem[];
  assignments: ServiceAssignment[];
  teamMembers: TeamMember[];
  churchName: string;
}

const ROLE_LABELS: Record<string, string> = {
  worship_leader: 'Worship Leader',
  lead_vocalist: 'Lead Vocalist',
  background_vocalist: 'Background Vocalist',
  acoustic_guitar: 'Acoustic Guitar',
  electric_guitar: 'Electric Guitar',
  bass_guitar: 'Bass Guitar',
  drums: 'Drums',
  keyboard: 'Keyboard/Piano',
  sound_tech: 'Sound Tech',
  media_tech: 'Media Tech',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function generateServicePDF(data: PrintData): Promise<void> {
  const { service, items, assignments, teamMembers, churchName } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(churchName, margin, 25);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(service.title, margin, 35);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  const displayDate = service.date
    ? new Date(service.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const timeStr = service.time || '';
  doc.text(`${displayDate}${displayDate && timeStr ? ' · ' : ''}${timeStr}`, margin, 43);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Status: ${service.status.charAt(0).toUpperCase() + service.status.slice(1)}`, margin, 51);

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, 57, pageWidth - margin, 57);

  let yPos = 65;

  if (service.notes) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Service Notes', margin, yPos);
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const splitNotes = doc.splitTextToSize(service.notes, contentWidth);
    doc.text(splitNotes, margin, yPos);
    yPos += splitNotes.length * 5 + 8;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Service Order', margin, yPos);
  yPos += 5;

  if (items.length > 0) {
    const itemRows = items.map((item, idx) => {
      const keyStr = item.key ? `Key: ${item.key}` : '';
      const durationStr = item.duration_minutes ? `${item.duration_minutes} min` : '';
      const assignedStr = item.assigned_to || '';
      const detailParts = [keyStr, durationStr, assignedStr].filter(Boolean);
      return [`${idx + 1}.`, item.type === 'song' ? 'Song' : 'Segment', item.title, detailParts.join(', ') || '—'];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Type', 'Item', 'Details']],
      body: itemRows,
      theme: 'grid',
      headStyles: { fillColor: [45, 145, 140], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 16 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 70 } },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('No items in service order.', margin, yPos + 5);
    yPos += 15;
  }

  if (yPos > 240) {
    doc.addPage();
    yPos = 25;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Team Schedule', margin, yPos);
  yPos += 5;

  if (assignments.length > 0) {
    const memberMap = new Map(teamMembers.map((m) => [m.id, m.name]));
    const assignmentRows = assignments.map((a) => {
      const memberName = memberMap.get(a.team_member_id) || 'Unknown';
      const statusIcon = a.status === 'confirmed' ? '✓' : a.status === 'declined' ? '✗' : '○';
      return [memberName, roleLabel(a.role), statusIcon, a.status.charAt(0).toUpperCase() + a.status.slice(1)];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Name', 'Role', '', 'Status']],
      body: assignmentRows,
      theme: 'grid',
      headStyles: { fillColor: [45, 145, 140], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 55 }, 2: { cellWidth: 12, halign: 'center' }, 3: { cellWidth: 45 } },
      margin: { left: margin, right: margin },
    });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('No team members assigned.', margin, yPos + 5);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generated by WorshipCenter · ${new Date().toLocaleDateString()} · Page ${i} of ${pageCount}`, margin, doc.internal.pageSize.getHeight() - 10);
  }

  const filename = `${churchName.replace(/[^a-zA-Z0-9]/g, '_')}_${service.title.replace(/[^a-zA-Z0-9]/g, '_')}_ServicePlan.pdf`;

  try {
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [pdfFile] })) {
      await navigator.share({ files: [pdfFile], title: filename });
      return;
    }
  } catch {
    // Web Share not supported or failed — fall through to download
  }
  doc.save(filename);
}