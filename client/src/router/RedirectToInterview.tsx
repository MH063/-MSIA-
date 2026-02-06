/**
 * 重定向组件：将 /sessions/:id 重定向到 /interview/:id
 */
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const RedirectToInterview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/interview/${id}`, { replace: true });
    } else {
      navigate('/sessions', { replace: true });
    }
  }, [id, navigate]);

  return null;
};

export default RedirectToInterview;
