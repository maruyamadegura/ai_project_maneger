/*
  # プロジェクトコラボレーション機能の追加

  1. 新しいテーブル
    - `project_members` - プロジェクトメンバー管理
    - `project_invitations` - プロジェクト招待管理
    - `project_activity_log` - プロジェクト活動ログ

  2. 既存テーブルの変更
    - `projects` テーブルに `owner_id` と `is_public` フィールドを追加

  3. セキュリティ
    - 適切なRLSポリシーを設定
    - メンバーシップベースのアクセス制御
*/

-- プロジェクトテーブルに新しいフィールドを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    -- 既存のプロジェクトのowner_idをuser_idと同じに設定
    UPDATE projects SET owner_id = user_id WHERE owner_id IS NULL;
    ALTER TABLE projects ALTER COLUMN owner_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE projects ADD COLUMN is_public boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE projects ADD COLUMN last_modified_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- プロジェクトメンバーテーブル
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- プロジェクト招待テーブル
CREATE TABLE IF NOT EXISTS project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, email)
);

-- プロジェクト活動ログテーブル
CREATE TABLE IF NOT EXISTS project_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLSを有効化
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity_log ENABLE ROW LEVEL SECURITY;

-- プロジェクトメンバーのRLSポリシー
CREATE POLICY "Users can view project members if they are members"
  ON project_members
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners and admins can manage members"
  ON project_members
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- プロジェクト招待のRLSポリシー
CREATE POLICY "Users can view invitations for their projects"
  ON project_invitations
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners and admins can manage invitations"
  ON project_invitations
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 活動ログのRLSポリシー
CREATE POLICY "Users can view activity log for their projects"
  ON project_activity_log
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create activity log entries"
  ON project_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- プロジェクトテーブルのRLSポリシーを更新
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- 新しいプロジェクトRLSポリシー
CREATE POLICY "Users can view projects they are members of"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    ) OR is_public = true
  );

CREATE POLICY "Users can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Project members can update projects based on role"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Only project owners can delete projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- プロジェクト作成時に自動的にオーナーをメンバーに追加する関数
CREATE OR REPLACE FUNCTION add_project_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_members (project_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- プロジェクト作成時のトリガー
DROP TRIGGER IF EXISTS add_project_owner_trigger ON projects;
CREATE TRIGGER add_project_owner_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_project_owner_as_member();

-- プロジェクト更新時に最終更新者を記録する関数
CREATE OR REPLACE FUNCTION update_project_modifier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_by = auth.uid();
  NEW.updated_at = now();
  
  -- 活動ログに記録
  INSERT INTO project_activity_log (project_id, user_id, action, details)
  VALUES (NEW.id, auth.uid(), 'project_updated', jsonb_build_object(
    'title', NEW.title,
    'changes', jsonb_build_object(
      'tasks_updated', CASE WHEN OLD.tasks_data != NEW.tasks_data THEN true ELSE false END,
      'gantt_updated', CASE WHEN OLD.gantt_data != NEW.gantt_data THEN true ELSE false END
    )
  ));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- プロジェクト更新時のトリガー
DROP TRIGGER IF EXISTS update_project_modifier_trigger ON projects;
CREATE TRIGGER update_project_modifier_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_project_modifier();

-- 招待受諾用の関数
CREATE OR REPLACE FUNCTION accept_project_invitation(invitation_token text)
RETURNS jsonb AS $$
DECLARE
  invitation_record project_invitations%ROWTYPE;
  user_email text;
BEGIN
  -- 現在のユーザーのメールアドレスを取得
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  -- 招待を取得
  SELECT * INTO invitation_record 
  FROM project_invitations 
  WHERE token = invitation_token 
    AND email = user_email 
    AND expires_at > now() 
    AND accepted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- メンバーとして追加
  INSERT INTO project_members (project_id, user_id, role, invited_by)
  VALUES (invitation_record.project_id, auth.uid(), invitation_record.role, invitation_record.invited_by)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = invitation_record.role;
  
  -- 招待を受諾済みとしてマーク
  UPDATE project_invitations 
  SET accepted_at = now() 
  WHERE id = invitation_record.id;
  
  -- 活動ログに記録
  INSERT INTO project_activity_log (project_id, user_id, action, details)
  VALUES (invitation_record.project_id, auth.uid(), 'member_joined', jsonb_build_object(
    'role', invitation_record.role,
    'invited_by', invitation_record.invited_by
  ));
  
  RETURN jsonb_build_object('success', true, 'project_id', invitation_record.project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;