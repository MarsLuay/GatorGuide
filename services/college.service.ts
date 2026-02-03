// services/college.service.ts
import { isStubMode } from './config';
import { db, auth } from './firebase'; 
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';

export type College = {
  id: string;
  name: string;
  location: { city: string; state: string; };
  tuition: number;
  size: 'small' | 'medium' | 'large';
  setting: 'urban' | 'suburban' | 'rural';
  admissionRate: number;
  programs: string[];
  matchScore?: number;
};

export type CollegeMatchCriteria = {
  major?: string;
  gpa?: string;
  testScores?: string;
  location?: string;
  budget?: string;
  size?: string;
  setting?: string;
  environment?: string;
};

class CollegeService {
  /**
   * TASK: Firebase Questionnaire collection
   * Saves user survey answers to Firestore
   */
  async saveQuestionnaireResult(answers: any): Promise<string> {
    if (isStubMode()) {
      console.log('[STUB] Saving questionnaire:', answers);
      return 'stub-id';
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required");

      const docRef = await addDoc(collection(db, 'questionnaires'), {
        userId: user.uid,
        answers: answers,
        createdAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error saving questionnaire:", error);
      throw error;
    }
  }

  /**
   * TASK: Firebase Saved Colleges collection
   * Adds or removes a college from user's favorites
   */
  async toggleSavedCollege(collegeId: string, isSaved: boolean): Promise<void> {
    if (isStubMode()) return;
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      savedColleges: isSaved ? arrayUnion(collegeId) : arrayRemove(collegeId)
    });
  }

  // --- Original Stub Methods (保持原样) ---
  async getMatches(criteria: CollegeMatchCriteria): Promise<College[]> {
    if (isStubMode()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return [
        { id: '1', name: 'University of Florida', location: { city: 'Gainesville', state: 'FL' }, tuition: 28659, size: 'large', setting: 'suburban', admissionRate: 0.23, programs: ['Computer Science'], matchScore: 95 },
      ];
    }
    throw new Error('College Scorecard API not configured');
  }

  async getCollegeDetails(collegeId: string): Promise<College> {
    if (isStubMode()) {
      return { id: collegeId, name: 'University of Florida', location: { city: 'Gainesville', state: 'FL' }, tuition: 28659, size: 'large', setting: 'suburban', admissionRate: 0.23, programs: ['CS'] };
    }
    throw new Error('Not implemented');
  }

  async searchColleges(query: string): Promise<College[]> {
    if (isStubMode()) {
      const all = await this.getMatches({});
      return all.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
    }
    throw new Error('Not implemented');
  }
}

export const collegeService = new CollegeService();