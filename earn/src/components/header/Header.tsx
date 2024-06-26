import { NavBar, NavBarLink } from 'shared/lib/components/navbar/NavBar';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { useGeoFencing } from 'shared/lib/hooks/UseGeoFencing';
import styled from 'styled-components';
import tw from 'twin.macro';

const DEFAULT_NAV_LINKS: NavBarLink[] = [
  {
    label: 'Portfolio',
    to: '/portfolio',
  },
  {
    label: 'Markets',
    to: '/markets',
  },
  {
    label: 'Advanced',
    to: '/borrow',
  },
];

const EXTENDED_NAV_LINKS: NavBarLink[] = [
  ...DEFAULT_NAV_LINKS.slice(0, 2),
  {
    label: 'Boost',
    to: '/boost',
  },
  ...DEFAULT_NAV_LINKS.slice(2),
];

const Nav = styled.nav`
  ${tw`fixed top-0 left-0 right-0 flex items-center h-16`}
  border-bottom: 1px solid ${GREY_700};
  background-color: rgba(6, 11, 15, 1);
  z-index: 40;
`;

export type HeaderProps = {
  checkboxes: React.ReactNode[];
};

export default function Header(props: HeaderProps) {
  const { checkboxes } = props;

  const { isAllowed } = useGeoFencing();
  const navLinks: NavBarLink[] = [
    ...(isAllowed ? EXTENDED_NAV_LINKS : DEFAULT_NAV_LINKS),
    // {
    //   label: 'Stats',
    //   to: '/stats',
    // },
  ];

  return (
    <Nav>
      <NavBar links={navLinks} checkboxes={checkboxes} isAllowedToInteract={true} />
    </Nav>
  );
}
