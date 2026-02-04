import { db } from "./firebase";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

export interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  category: "Documents" | "Academics" | "Applications" | "Interests";
  expanded?: boolean;
}

export const roadmapService = {

  generateInitialRoadmap: async (userId: string, major: string, gpa: string) => {
    const roadmapRef = doc(db, "roadmaps", userId);
    
    const tasks: RoadmapTask[] = [
      { id: "doc-1", title: "Refine Resume", description: `Tailor your resume for ${major} internships.`, completed: false, category: "Documents" },
      { id: "acad-1", title: "Target GPA Maintenance", description: `You're at ${gpa}. Keep it above 3.8 for top schools.`, completed: false, category: "Academics" },
      { id: "app-1", title: "Research Transfer Credits", description: `Check how your current courses transfer to ${major} programs.`, completed: false, category: "Applications" },
    ];

    await setDoc(roadmapRef, {
      userId,
      tasks,
      lastUpdated: new Date().toISOString(),
    });
    return tasks;
  },


  getUserRoadmap: async (userId: string) => {
    const docSnap = await getDoc(doc(db, "roadmaps", userId));
    return docSnap.exists() ? docSnap.data().tasks as RoadmapTask[] : [];
  },


  toggleTaskStatus: async (userId: string, tasks: RoadmapTask[]) => {
    const roadmapRef = doc(db, "roadmaps", userId);
    await updateDoc(roadmapRef, { tasks });
  }
};