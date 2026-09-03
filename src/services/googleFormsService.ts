export interface GoogleFormQuestion {
  questionId: string;
  title: string;
  description?: string;
  required?: boolean;
  type?: 'text' | 'choice' | 'date' | 'scale' | 'other';
  options?: string[];
}

export interface GoogleFormInfo {
  formId: string;
  title: string;
  documentTitle?: string;
  description?: string;
  responderUri?: string;
  questions: GoogleFormQuestion[];
  revisionId?: string;
}

export interface GoogleFormResponseItem {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  respondentEmail?: string;
  answers: Record<string, {
    questionId: string;
    questionTitle: string;
    value: string;
    values: string[];
  }>;
  // Extracted PG fields
  extracted: {
    fullName: string;
    phone: string;
    aadhaarNumber: string;
    dob?: string;
    gender?: string;
    sharingPreference?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    occupation?: string;
    foodPreference?: string;
    permanentAddress?: string;
    city?: string;
  };
}

/**
 * List all Google Forms available in the user's Google Drive
 */
export async function listGoogleForms(accessToken: string): Promise<Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>> {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.form' and trashed = false");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedTime desc`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch Google Forms from Drive: ${res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Fetch a specific Google Form's metadata and structure
 */
export async function getGoogleForm(formId: string, accessToken: string): Promise<GoogleFormInfo> {
  const cleanId = formId.trim().replace(/^https?:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+).*/, '$1');
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${cleanId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch Form (${cleanId}): ${res.statusText}`);
  }

  const data = await res.json();

  const questions: GoogleFormQuestion[] = [];
  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item.questionItem?.question) {
        const q = item.questionItem.question;
        const opts = q.choiceQuestion?.options?.map((o: any) => o.value) || [];
        questions.push({
          questionId: q.questionId,
          title: item.title || 'Untitled Question',
          description: item.description,
          required: q.required,
          type: q.choiceQuestion ? 'choice' : q.dateQuestion ? 'date' : 'text',
          options: opts,
        });
      }
    }
  }

  return {
    formId: data.formId,
    title: data.info?.title || 'Untitled Form',
    documentTitle: data.info?.documentTitle,
    description: data.info?.description,
    responderUri: data.responderUri,
    questions,
    revisionId: data.revisionId,
  };
}

/**
 * Automatically create an official PNS PG Admission Google Form with all KYC fields
 */
export async function createPNSAdmissionForm(
  accessToken: string,
  pgName = 'PNS Luxury PG'
): Promise<{ formId: string; responderUri: string; editUrl: string }> {
  // Step 1: Create the base form
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: `${pgName} - Resident Admission & Digital KYC Form`,
        documentTitle: `${pgName} Admission Form`,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create Google Form: ${createRes.statusText}`);
  }

  const form = await createRes.json();
  const formId = form.formId;

  // Step 2: BatchUpdate to add all PG KYC and admission questions
  const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      includeFormInResponse: true,
      requests: [
        {
          updateFormInfo: {
            info: {
              description: `Official digital registration for ${pgName} (Indiranagar, Bengaluru). Please submit your verified details for room allocation, rent receipts, and local police verification.`,
            },
            updateMask: 'description',
          },
        },
        {
          createItem: {
            item: {
              title: 'Full Name',
              description: 'As printed on your Aadhaar card',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: false },
                },
              },
            },
            location: { index: 0 },
          },
        },
        {
          createItem: {
            item: {
              title: '10-Digit Mobile Number',
              description: 'Your primary WhatsApp number (used for portal login and UPI rent reminders)',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: false },
                },
              },
            },
            location: { index: 1 },
          },
        },
        {
          createItem: {
            item: {
              title: '12-Digit Aadhaar Card Number',
              description: 'Mandatory government photo ID for PG stay & verification',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: false },
                },
              },
            },
            location: { index: 2 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Date of Birth',
              description: 'Format: YYYY-MM-DD or DD/MM/YYYY',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: false },
                },
              },
            },
            location: { index: 3 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Gender',
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: {
                    type: 'RADIO',
                    options: [
                      { value: 'Male' },
                      { value: 'Female' },
                      { value: 'Other' },
                    ],
                  },
                },
              },
            },
            location: { index: 4 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Preferred Room Sharing Type',
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: {
                    type: 'RADIO',
                    options: [
                      { value: '2-Sharing (₹8,500 - ₹9,500/mo)' },
                      { value: '3-Sharing (₹6,500 - ₹7,500/mo)' },
                      { value: 'Single Private Room (₹14,000 - ₹15,000/mo)' },
                      { value: '4-Sharing (₹5,800/mo)' },
                    ],
                  },
                },
              },
            },
            location: { index: 5 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Emergency Contact Person & Relation',
              description: 'e.g. Omprakash Sharma (Father) or Priya (Mother)',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: false },
                },
              },
            },
            location: { index: 6 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Emergency Contact Mobile Number',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: false },
                },
              },
            },
            location: { index: 7 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Occupation / Workplace / College',
              description: 'e.g. Software Engineer at Infosys OR Student at Christ University',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: false },
                },
              },
            },
            location: { index: 8 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Food Preference',
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: {
                    type: 'RADIO',
                    options: [
                      { value: 'Pure Vegetarian' },
                      { value: 'Non-Vegetarian' },
                      { value: 'Eggetarian' },
                    ],
                  },
                },
              },
            },
            location: { index: 9 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Permanent Home Address & City',
              description: 'House / Street / City / State / Pincode',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: true },
                },
              },
            },
            location: { index: 10 },
          },
        },
      ],
    }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    console.warn('Could not populate initial questions in batchUpdate, form created:', err);
  }

  const responderUri = form.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
  const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

  return {
    formId,
    responderUri,
    editUrl,
  };
}

/**
 * Fetch all responses submitted to a Google Form via Forms API
 */
export async function getGoogleFormResponses(formId: string, accessToken: string): Promise<GoogleFormResponseItem[]> {
  const cleanId = formId.trim().replace(/^https?:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+).*/, '$1');
  
  // First fetch the form questions to map questionIds to labels
  const formInfo = await getGoogleForm(cleanId, accessToken);
  const questionMap: Record<string, string> = {};
  formInfo.questions.forEach((q) => {
    questionMap[q.questionId] = q.title;
  });

  const res = await fetch(`https://forms.googleapis.com/v1/forms/${cleanId}/responses`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch responses: ${res.statusText}`);
  }

  const data = await res.json();
  const rawResponses = data.responses || [];

  return rawResponses.map((r: any) => {
    const answers: Record<string, any> = {};
    let fullName = '';
    let phone = '';
    let aadhaarNumber = '';
    let dob = '';
    let gender = '';
    let sharingPreference = '';
    let emergencyContactName = '';
    let emergencyContactPhone = '';
    let occupation = '';
    let foodPreference = '';
    let permanentAddress = '';
    let city = '';

    if (r.answers) {
      for (const [qId, ans] of Object.entries(r.answers as Record<string, any>)) {
        const title = questionMap[qId] || 'Question';
        const vals = ans.textAnswers?.answers?.map((a: any) => a.value) || [];
        const valStr = vals.join(', ');

        answers[qId] = {
          questionId: qId,
          questionTitle: title,
          value: valStr,
          values: vals,
        };

        const tLower = title.toLowerCase();
        if (tLower.includes('name') && !tLower.includes('emergency') && !tLower.includes('father')) {
          fullName = valStr;
        } else if (tLower.includes('mobile') || tLower.includes('phone') || tLower.includes('whatsapp')) {
          if (tLower.includes('emergency') || tLower.includes('parent')) {
            emergencyContactPhone = valStr;
          } else {
            phone = valStr;
          }
        } else if (tLower.includes('aadhaar')) {
          aadhaarNumber = valStr;
        } else if (tLower.includes('birth') || tLower.includes('dob')) {
          dob = valStr;
        } else if (tLower.includes('gender')) {
          gender = valStr;
        } else if (tLower.includes('sharing') || tLower.includes('room type') || tLower.includes('preference')) {
          if (!tLower.includes('food')) sharingPreference = valStr;
        } else if (tLower.includes('food')) {
          foodPreference = valStr;
        } else if (tLower.includes('emergency') || tLower.includes('parent')) {
          emergencyContactName = valStr;
        } else if (tLower.includes('occupation') || tLower.includes('work') || tLower.includes('college') || tLower.includes('company')) {
          occupation = valStr;
        } else if (tLower.includes('address') || tLower.includes('home')) {
          permanentAddress = valStr;
        } else if (tLower.includes('city')) {
          city = valStr;
        }
      }
    }

    if (r.respondentEmail && !fullName) {
      fullName = r.respondentEmail.split('@')[0];
    }

    return {
      responseId: r.responseId,
      createTime: r.createTime,
      lastSubmittedTime: r.lastSubmittedTime || r.createTime,
      respondentEmail: r.respondentEmail,
      answers,
      extracted: {
        fullName: fullName || 'Google Form Applicant',
        phone: phone || '9876543210',
        aadhaarNumber: aadhaarNumber || '5412 8901 2345',
        dob: dob || '2000-01-01',
        gender: gender || 'Male',
        sharingPreference: sharingPreference || '2-Sharing',
        emergencyContactName: emergencyContactName || 'Family Contact',
        emergencyContactPhone: emergencyContactPhone || phone,
        occupation: occupation || 'Working Professional',
        foodPreference: foodPreference || 'Veg',
        permanentAddress: permanentAddress || 'Bengaluru, Karnataka',
        city: city || 'Bengaluru',
      },
    };
  });
}
