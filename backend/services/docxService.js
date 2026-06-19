import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType } from 'docx';

const htmlToPlainText = (html = '') => String(html)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\n{3,}/g, '\n\n')
  .trim();

export const generateSyllabusDocx = async (version) => {
  const course = version.courseId;
  const reg = version.regulationId;
  
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "ADITYA UNIVERSITY",
                bold: true,
                size: 28,
                color: "1e3a8a"
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { bottom: 200 },
            children: [
              new TextRun({
                text: `Outcome Based Education (OBE) Curriculum - ${reg?.code || 'R24'}`,
                bold: true,
                size: 20,
                color: "4b5563"
              })
            ]
          }),
          
          // Course Info Table
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Course Code: ", bold: true }),
                          new TextRun({ text: course?.code || '' })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Course Title: ", bold: true }),
                          new TextRun({ text: course?.title || '' })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Credits (L-T-P-S-C): ", bold: true }),
                          new TextRun({ text: `${version.credits?.L || 0}-${version.credits?.T || 0}-${version.credits?.P || 0}-${version.credits?.S || 0}-${version.credits?.C || 0}` })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Category: ", bold: true }),
                          new TextRun({ text: version.category || 'PC' })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Semester: ", bold: true }),
                          new TextRun({ text: `${version.semester || 1}` })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          
          new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),
          
          // Section 1: Course Outcomes
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Course Outcomes (COs)", bold: true, color: "1e3a8a" })]
          }),
          
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "CO Code", bold: true })] })] }),
                  new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Course Outcome Description", bold: true })] })] }),
                  new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Bloom Level", bold: true })] })] })
                ]
              }),
              ...(version.courseOutcomes || []).map(co => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: co.coCode })] }),
                  new TableCell({ children: [new Paragraph({ text: co.description })] }),
                  new TableCell({ children: [new Paragraph({ text: co.bloomLevel })] })
                ]
              }))
            ]
          }),
          
          new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),
          
          // Section 2: Mapping
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "CO-PO & CO-PSO Mapping Matrix", bold: true, color: "1e3a8a" })]
          }),
          
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CO/PO", bold: true })] })] }),
                  ...Array.from({ length: 12 }, (_, i) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `PO${i+1}`, bold: true })] })] })),
                  ...Array.from({ length: 3 }, (_, i) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `PSO${i+1}`, bold: true })] })] }))
                ]
              }),
              ...(version.courseOutcomes || []).map(co => {
                const poMap = (version.coPoMappings || []).find(m => m.coCode === co.coCode)?.po || {};
                const psoMap = (version.coPsoMappings || []).find(m => m.coCode === co.coCode)?.pso || {};
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: co.coCode })] }),
                    ...Array.from({ length: 12 }, (_, i) => {
                      const v = poMap instanceof Map ? poMap.get(`PO${i+1}`) : poMap[`PO${i+1}`];
                      return new TableCell({ children: [new Paragraph({ text: v !== undefined ? String(v) : "-" })] });
                    }),
                    ...Array.from({ length: 3 }, (_, i) => {
                      const v = psoMap instanceof Map ? psoMap.get(`PSO${i+1}`) : psoMap[`PSO${i+1}`];
                      return new TableCell({ children: [new Paragraph({ text: v !== undefined ? String(v) : "-" })] });
                    })
                  ]
                });
              })
            ]
          }),
          
          new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),
          
          // Section 3: Unit-wise Syllabus
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Unit-wise Syllabus", bold: true, color: "1e3a8a" })]
          }),
          
          ...(version.syllabusUnits || []).map(unit => {
            const unitContent = htmlToPlainText(unit.richTextContent || unit.description || '');
            return [
              new Paragraph({
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 100, bottom: 50 },
                children: [
                  new TextRun({ text: `UNIT - ${unit.unitNumber}`, bold: true })
                ]
              }),
              new Paragraph({
                spacing: { bottom: 100 },
                children: [new TextRun({ text: unitContent || 'Syllabus content not entered.' })]
              })
            ].filter(Boolean);
          }).flat(),
          
          new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),
          
          // Section 4: Textbooks & Reference Books
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Textbooks & Reference Materials", bold: true, color: "1e3a8a" })]
          }),
          new Paragraph({
            children: [new TextRun({ text: "Textbooks:", bold: true })]
          }),
          ...(version.textbooks || []).map(tb => new Paragraph({
            bullet: { level: 0 },
            text: tb
          })),
          new Paragraph({
            children: [new TextRun({ text: "Reference Materials:", bold: true }), ],
            spacing: { before: 100 }
          }),
          ...(version.referenceMaterials || []).map(ref => new Paragraph({
            bullet: { level: 0 },
            text: ref
          }))
        ]
      }
    ]
  });
  
  return Packer.toBuffer(doc);
};
